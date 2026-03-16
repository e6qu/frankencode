import { Tool } from "./tool"
import { SideThread } from "@/session/side-thread"
import { Storage } from "@/storage/storage"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionID } from "@/session/schema"
import { SessionPrompt } from "@/session/prompt"
import { Agent } from "@/agent/agent"
import { MessageV2 } from "@/session/message-v2"
import { ClassifierThreadsSchema, type ClassifierThreads } from "./classifier-threads"
import z from "zod"

export const DistillThreadsTool = Tool.define("distill_threads", {
  description: `Distill the conversation into threads. Runs as a subagent session (does not pollute main context).

Classifies all messages by topic, stores thread metadata per-session, and parks side threads.
Returns the classification and any threads created. Use classifier_threads first if you just want to preview.

Optionally specify mainTopics to override objective detection.`,

  parameters: z.object({
    mainTopics: z
      .array(z.string())
      .optional()
      .describe("Topics to treat as main thread (overrides objective detection)"),
  }),

  async execute(args, ctx) {
    const classifier = await Agent.get("classifier")
    if (!classifier)
      return { title: "Error", metadata: { externalized: 0, parked: 0 }, output: "Classifier agent not available" }

    const msgs = ctx.messages
    if (msgs.length === 0)
      return { title: "No messages", metadata: { externalized: 0, parked: 0 }, output: "No messages to distill" }

    const objective = msgs
      .filter((m) => m.info.role === "user")
      .flatMap((m) => m.parts)
      .find((p) => p.type === "text")
    const objectiveText =
      objective && "text" in objective ? (objective as MessageV2.TextPart).text.slice(0, 200) : "unknown"

    const summary = msgs.map((m) => {
      const role = m.info.role
      const id = m.info.id
      const parts = m.parts
        .filter((p) => p.type === "text" || p.type === "tool")
        .map((p) => {
          if (p.type === "text") return `[text] ${(p as MessageV2.TextPart).text.slice(0, 100)}`
          if (p.type === "tool") return `[tool:${(p as MessageV2.ToolPart).tool}]`
          return ""
        })
        .filter(Boolean)
        .join(" | ")
      return `${id} (${role}): ${parts}`
    })

    const prompt = [
      classifier.prompt ?? "",
      `\n## Current Objective\n${objectiveText}`,
      `\n## Messages to classify (${msgs.length} total)\n${summary.join("\n")}`,
    ].join("\n")

    // Run classifier in a subagent session
    const session = await Session.create({
      parentID: SessionID.make(ctx.sessionID),
      title: "distill-threads",
    })

    const result = await SessionPrompt.prompt({
      sessionID: session.id,
      parts: [{ type: "text", text: prompt }],
      agent: "classifier",
      model: (msgs.find((m) => m.info.role === "user")?.info as MessageV2.User | undefined)?.model,
    })

    // Delete the temporary classifier session to avoid orphan sessions
    await Session.remove(session.id)

    const text = result.parts.findLast((p) => p.type === "text" && "text" in p)
    const raw = text && "text" in text ? (text as MessageV2.TextPart).text : ""

    let parsed: ClassifierThreads = []
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) parsed = ClassifierThreadsSchema.parse(JSON.parse(jsonMatch[0]))
    } catch {
      return {
        title: "Parse error",
        metadata: { externalized: 0, parked: 0 },
        output: `Could not parse classifier output:\n${raw.slice(0, 500)}`,
      }
    }

    const mainTopics = args.mainTopics ? new Set(args.mainTopics.map((t: string) => t.toLowerCase())) : null

    // Group side messages by topic
    const sideGroups = new Map<string, string[]>()
    for (const c of parsed) {
      let effective = c.classification
      if (mainTopics) {
        const hasMain = c.topics.some((t: string) => mainTopics.has(t.toLowerCase()))
        const hasSide = c.topics.some((t: string) => !mainTopics.has(t.toLowerCase()))
        if (hasMain && !hasSide) effective = "main"
        else if (!hasMain) effective = "side"
        else effective = "mixed"
      }
      if (effective === "main") continue
      for (const topic of c.topics) {
        if (mainTopics && mainTopics.has(topic.toLowerCase())) continue
        const group = sideGroups.get(topic) ?? []
        group.push(c.messageID)
        sideGroups.set(topic, group)
      }
    }

    // Park side threads
    const parkedThreads: { threadID: string; topic: string; messageIDs: string[] }[] = []
    const entries = Array.from(sideGroups.entries())
    for (const [topic, messageIDs] of entries) {
      const thread = SideThread.create({
        projectID: Instance.project.id,
        title: topic,
        description: `Distilled from ${messageIDs.length} message(s)`,
        priority: "medium",
        category: "other",
        sourceSessionID: ctx.sessionID,
        createdBy: ctx.agent,
      })
      parkedThreads.push({ threadID: thread.id, topic, messageIDs })
    }

    // Store thread metadata in per-session storage
    const allTopics = parsed.flatMap((c) => c.topics).filter((t, i, a) => a.indexOf(t) === i)
    const meta = {
      sessionID: ctx.sessionID,
      classifiedAt: Date.now(),
      topics: allTopics,
      messages: parsed.map((c) => ({ messageID: c.messageID, classification: c.classification, topics: c.topics })),
      parkedThreads,
    }
    await Storage.write(["threads-meta", ctx.sessionID], meta)

    return {
      title: `${parsed.length} classified, ${parkedThreads.length} threads parked`,
      metadata: { externalized: 0, parked: parkedThreads.length },
      output: [
        `Classified: ${parsed.length} messages, ${allTopics.length} topics`,
        `Topics: ${allTopics.join(", ")}`,
        `Parked: ${parkedThreads.length} side threads`,
        ...(parkedThreads.length
          ? parkedThreads.map((t) => `  ${t.threadID}: ${t.topic} (${t.messageIDs.length} msgs)`)
          : []),
        `\nThread metadata stored for session ${ctx.sessionID.slice(0, 16)}`,
        `Retrieve with: Storage.read(["threads-meta", "${ctx.sessionID}"])`,
      ].join("\n"),
    }
  },
})
