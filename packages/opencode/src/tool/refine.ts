import { Tool } from "./tool"
import z from "zod"
import { Session } from "../session"
import { SessionID, MessageID } from "../session/schema"
import { MessageV2 } from "../session/message-v2"
import { Agent } from "../agent/agent"
import { SessionPrompt } from "../session/prompt"
import { Log } from "@/util/log"
import { defer } from "@/util/defer"

const log = Log.create({ service: "tool.refine" })

function buildChangeSummary(messages: MessageV2.WithParts[]): string {
  const lines: string[] = []
  for (const m of messages) {
    const parts = m.parts
      .filter((p): p is MessageV2.TextPart | MessageV2.ToolPart => p.type === "text" || p.type === "tool")
      .map((p) => {
        if (p.type === "text") return `[text] ${p.text.slice(0, 500)}`
        if (p.type === "tool") {
          return `[tool:${p.tool}] ${p.state.status}`
        }
        return ""
      })
      .filter(Boolean)
      .join(" | ")
    if (parts) lines.push(`${m.info.id} (${m.info.role}): ${parts}`)
  }
  return lines.join("\n")
}

const parameters = z.object({
  description: z.string().describe("What changes need to be refined"),
  maxIterations: z.number().min(1).max(5).default(3),
  criteria: z.array(z.string()).optional(),
})

export const RefineTool = Tool.define("refine", {
  description: `Run evaluator-optimizer loop to iteratively improve code changes.

Use this tool when:
- You've made changes and want quality assurance
- Changes are complex and need review
- You want to catch issues before finalizing

The tool runs in cycles:
1. Evaluator reviews changes and scores them (1-10)
2. If score < 7, optimizer improves based on feedback
3. Loop continues until score >= 7 or max iterations reached

Returns final evaluation with score and any remaining issues.`,

  parameters,

  async execute(args, ctx) {
    const maxIter = args.maxIterations ?? 3

    const evaluator = await Agent.get("evaluator")
    const optimizer = await Agent.get("optimizer")

    if (!evaluator || !optimizer) {
      return {
        title: "Refine failed",
        output: "Evaluator or optimizer agent not found",
        metadata: { success: false, iterations: 0, finalScore: 0 },
      }
    }

    const msg = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
    if (msg.info.role !== "assistant") {
      return {
        title: "Refine failed",
        output: "Can only be called from assistant message",
        metadata: { success: false, iterations: 0, finalScore: 0 },
      }
    }

    const model = {
      modelID: msg.info.modelID,
      providerID: msg.info.providerID,
    }

    const results: { iteration: number; score: number; passed: boolean; issues: string[] }[] = []

    const parentMessages: MessageV2.WithParts[] = []
    for await (const msg of MessageV2.stream(ctx.sessionID)) {
      parentMessages.push(msg)
    }
    const changeSummary = buildChangeSummary(parentMessages)

    const sessionIDs: SessionID[] = []
    try {
      for (let i = 0; i < maxIter; i++) {
        const session = await Session.create({
          parentID: ctx.sessionID,
          title: `refine-${i + 1}`,
          permission: [],
        })
        sessionIDs.push(session.id)

        const evalPrompt = [
          `## Recent Changes`,
          changeSummary,
          "",
          `Evaluate the following changes for: ${args.description}`,
          args.criteria?.length ? `Criteria: ${args.criteria.join(", ")}` : "",
          "Provide your evaluation in the required format.",
        ]
          .filter(Boolean)
          .join("\n")

        const messageID = MessageID.ascending()

        function cancel() {
          SessionPrompt.cancel(session.id)
        }
        ctx.abort.addEventListener("abort", cancel)
        using _ = defer(() => ctx.abort.removeEventListener("abort", cancel))

        const evalResult = await SessionPrompt.prompt({
          messageID,
          sessionID: session.id,
          model,
          agent: evaluator.name,
          parts: [{ type: "text" as const, text: evalPrompt }],
        })

        const evalText = evalResult.parts.findLast((x) => x.type === "text")?.text ?? ""
        const parsed = parseEvaluation(evalText)

        results.push({
          iteration: i + 1,
          score: parsed.score,
          passed: parsed.passed,
          issues: parsed.issues,
        })

        log.info("evaluation complete", { iteration: i + 1, score: parsed.score, passed: parsed.passed })

        if (parsed.passed) {
          return {
            title: `Refinement passed (iteration ${i + 1})`,
            output: formatResults(results),
            metadata: { success: true, iterations: i + 1, finalScore: parsed.score },
          }
        }

        if (i < maxIter - 1) {
          const optSession = await Session.create({
            parentID: ctx.sessionID,
            title: `optimize-${i + 1}`,
            permission: [],
          })
          sessionIDs.push(optSession.id)

          const optPrompt = [
            `Optimize the changes based on this evaluation feedback:`,
            `Score: ${parsed.score}/10`,
            `Issues: ${parsed.issues.join("; ")}`,
            `Suggestions: ${parsed.suggestions.join("; ")}`,
            "",
            "Make targeted improvements to address these issues.",
          ].join("\n")

          const optMessageID = MessageID.ascending()

          function optCancel() {
            SessionPrompt.cancel(optSession.id)
          }
          ctx.abort.addEventListener("abort", optCancel)
          using _opt = defer(() => ctx.abort.removeEventListener("abort", optCancel))

          await SessionPrompt.prompt({
            messageID: optMessageID,
            sessionID: optSession.id,
            model,
            agent: optimizer.name,
            parts: [{ type: "text" as const, text: optPrompt }],
          })
        }
      }

      const last = results[results.length - 1]
      return {
        title: `Refinement incomplete after ${maxIter} iterations`,
        output: formatResults(results),
        metadata: { success: false, iterations: maxIter, finalScore: last?.score ?? 0 },
      }
    } finally {
      for (const id of sessionIDs) {
        Session.remove(id).catch((err) => log.warn("failed to clean up refine session", { id, err }))
      }
    }
  },
})

interface ParsedEvaluation {
  score: number
  passed: boolean
  issues: string[]
  suggestions: string[]
}

function parseEvaluation(text: string): ParsedEvaluation {
  // Extract evaluation block first to avoid matching echoed template placeholders
  const evalBlock = text.match(/<evaluation>([\s\S]*?)<\/evaluation>/i)
  const evalText = evalBlock ? evalBlock[1] : text

  const scoreMatch = evalText.match(/<score>\s*(\d+)\s*<\/score>/i)
  const passedMatch = evalText.match(/<passed>\s*(true|false)\s*<\/passed>/i)
  const issuesMatch = evalText.match(/<issues>([\s\S]*?)<\/issues>/i)
  const suggestionsMatch = evalText.match(/<suggestions>([\s\S]*?)<\/suggestions>/i)

  const rawScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0
  const score = Number.isNaN(rawScore) ? 0 : rawScore
  const passed = passedMatch ? passedMatch[1].toLowerCase() === "true" : score >= 7

  const issues = issuesMatch
    ? issuesMatch[1]
        .split(/[\n\-]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const suggestions = suggestionsMatch
    ? suggestionsMatch[1]
        .split(/[\n\-]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  return { score, passed, issues, suggestions }
}

function formatResults(results: { iteration: number; score: number; passed: boolean; issues: string[] }[]) {
  const lines = ["## Refinement Results", ""]
  for (const r of results) {
    const status = r.passed ? "✓" : "✗"
    lines.push(`### Iteration ${r.iteration} [${status}]`)
    lines.push(`Score: ${r.score}/10`)
    if (r.issues.length) {
      lines.push(`Issues: ${r.issues.slice(0, 3).join("; ")}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}
