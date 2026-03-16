import { Tool } from "./tool"
import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"
import { SessionID } from "@/session/schema"
import { SessionPrompt } from "@/session/prompt"
import { Agent } from "@/agent/agent"
import z from "zod"

export const ClassifierThreadsSchema = z.array(
  z.object({
    messageID: z.string(),
    classification: z.enum(["main", "side", "mixed"]),
    topics: z.array(z.string()),
    reason: z.string(),
  }),
)
export type ClassifierThreads = z.infer<typeof ClassifierThreadsSchema>

export const ClassifierThreadsTool = Tool.define("classifier_threads", {
  description: `Classify conversation messages into threads by topic.

Runs the classifier agent to label each message as:
- "main": on-topic, relates to current objective
- "side": off-topic, tangential discovery
- "mixed": partially on-topic, partially off-topic

Each message gets topic labels (e.g. "pagination", "auth-middleware", "db-pool").
Returns structured JSON. Use distill_threads to act on the results.`,

  parameters: z.object({}),

  async execute(_args, ctx) {
    const classifier = await Agent.get("classifier")
    if (!classifier)
      return {
        title: "Error",
        metadata: {
          classifications: [] as ClassifierThreads,
          topics: [] as string[],
          counts: { main: 0, side: 0, mixed: 0 },
        },
        output: "Classifier agent not found or disabled",
      }

    const msgs = ctx.messages
    if (msgs.length === 0)
      return {
        title: "No messages",
        metadata: {
          classifications: [] as ClassifierThreads,
          topics: [] as string[],
          counts: { main: 0, side: 0, mixed: 0 },
        },
        output: "No messages to classify",
      }

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
          if (p.type === "tool") {
            const tp = p as MessageV2.ToolPart
            return `[tool:${tp.tool}] ${tp.state.status}`
          }
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

    const session = await Session.create({
      parentID: SessionID.make(ctx.sessionID),
      title: "classifier",
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
        metadata: {
          classifications: [] as ClassifierThreads,
          topics: [] as string[],
          counts: { main: 0, side: 0, mixed: 0 },
        },
        output: `Classifier output could not be parsed:\n${raw.slice(0, 500)}`,
      }
    }

    const seen = new Map<string, true>()
    const topics = parsed.flatMap((c) => c.topics).filter((t) => (seen.has(t) ? false : (seen.set(t, true), true)))
    const counts = {
      main: parsed.filter((c) => c.classification === "main").length,
      side: parsed.filter((c) => c.classification === "side").length,
      mixed: parsed.filter((c) => c.classification === "mixed").length,
    }

    const lines = parsed.map(
      (c) => `${c.messageID.slice(0, 16)} [${c.classification}] topics: ${c.topics.join(", ")} — ${c.reason}`,
    )

    return {
      title: `${parsed.length} classified, ${topics.length} topics`,
      metadata: { classifications: parsed, topics, counts },
      output: [
        `Topics found: ${topics.join(", ")}`,
        `Main: ${counts.main} | Side: ${counts.side} | Mixed: ${counts.mixed}`,
        "",
        ...lines,
      ].join("\n"),
    }
  },
})
