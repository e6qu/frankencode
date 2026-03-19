import { BusEvent } from "@/bus/bus-event"
import { SessionID, MessageID } from "@/session/schema"
import z from "zod"
import { Config } from "../config/config"
import { InstanceALS } from "../project/instance-als"
import { registerDisposer } from "@/effect/instance-registry"
import { Identifier } from "../id/id"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"
import PROMPT_BTW from "./template/btw.txt"
import PROMPT_FOCUS from "./template/focus.txt"
import PROMPT_REWRITE_HISTORY from "./template/focus-rewrite-history.txt"
import PROMPT_RESET_CONTEXT from "./template/reset-context.txt"
import PROMPT_OBJECTIVE from "./template/objective.txt"
import PROMPT_THREADS from "./template/threads.txt"
import PROMPT_HISTORY from "./template/history.txt"
import PROMPT_TREE from "./template/tree.txt"
import PROMPT_DEREF from "./template/deref.txt"
import PROMPT_CLASSIFY from "./template/classify.txt"
import PROMPT_VERIFY from "./template/verify.txt"
import { MCP } from "../mcp"
import { Skill } from "../skill"

export const commandStates = new Map<string, Promise<Record<string, Command.Info>>>()
registerDisposer(async (directory) => {
  commandStates.delete(directory)
})

export namespace Command {
  export const Event = {
    Executed: BusEvent.define(
      "command.executed",
      z.object({
        name: z.string(),
        sessionID: SessionID.zod,
        arguments: z.string(),
        messageID: MessageID.zod,
      }),
    ),
  }

  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      agent: z.string().optional(),
      model: z.string().optional(),
      source: z.enum(["command", "mcp", "skill"]).optional(),
      // workaround for zod not supporting async functions natively so we use getters
      // https://zod.dev/v4/changelog?id=zfunction
      template: z.promise(z.string()).or(z.string()),
      subtask: z.boolean().optional(),
      ephemeral: z.boolean().optional(),
      hints: z.array(z.string()),
    })
    .meta({
      ref: "Command",
    })

  // for some reason zod is inferring `string` for z.promise(z.string()).or(z.string()) so we have to manually override it
  export type Info = Omit<z.infer<typeof Info>, "template"> & { template: Promise<string> | string }

  export function hints(template: string): string[] {
    const result: string[] = []
    const numbered = template.match(/\$\d+/g)
    if (numbered) {
      for (const match of [...new Set(numbered)].sort()) result.push(match)
    }
    if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
    return result
  }

  export const Default = {
    INIT: "init",
    REVIEW: "review",
    BTW: "btw",
    FOCUS: "focus",
    FOCUS_REWRITE: "focus-rewrite-history",
    RESET_CONTEXT: "reset-context",
    OBJECTIVE: "objective",
    THREADS: "threads",
    HISTORY: "history",
    TREE: "tree",
    DEREF: "deref",
    CLASSIFY: "classify",
    VERIFY: "verify",
  } as const

  function state(directory: string): Promise<Record<string, Info>> {
    let s = commandStates.get(directory)
    if (!s) {
      s = initCommands()
      commandStates.set(directory, s)
    }
    return s
  }

  async function initCommands(): Promise<Record<string, Info>> {
    const cfg = await Config.get()
    const worktree = InstanceALS.worktree

    const result: Record<string, Info> = {
      [Default.INIT]: {
        name: Default.INIT,
        description: "create/update AGENTS.md",
        source: "command",
        get template() {
          return PROMPT_INITIALIZE.replace("${path}", worktree)
        },
        hints: hints(PROMPT_INITIALIZE),
      },
      [Default.REVIEW]: {
        name: Default.REVIEW,
        description: "review changes [commit|branch|pr], defaults to uncommitted",
        source: "command",
        get template() {
          return PROMPT_REVIEW.replace("${path}", worktree)
        },
        subtask: true,
        hints: hints(PROMPT_REVIEW),
      },
      [Default.BTW]: {
        name: Default.BTW,
        description: "side conversation — forks session, answers without polluting main thread",
        source: "command",
        get template() {
          return PROMPT_BTW
        },
        subtask: true,
        agent: "general",
        hints: hints(PROMPT_BTW),
      },
      [Default.FOCUS]: {
        name: Default.FOCUS,
        description: "clean up context — classify messages, externalize stale output, park side threads",
        source: "command",
        get template() {
          return PROMPT_FOCUS
        },
        hints: hints(PROMPT_FOCUS),
      },
      [Default.FOCUS_REWRITE]: {
        name: Default.FOCUS_REWRITE,
        description: "rewrite conversation history to focus on the objective (asks for confirmation first)",
        source: "command",
        get template() {
          return PROMPT_REWRITE_HISTORY
        },
        subtask: true,
        agent: "focus-rewrite-history",
        hints: hints(PROMPT_REWRITE_HISTORY),
      },
      [Default.RESET_CONTEXT]: {
        name: Default.RESET_CONTEXT,
        description: "reset all context edits — restore every part to its original content from CAS",
        source: "command",
        get template() {
          return PROMPT_RESET_CONTEXT
        },
        hints: hints(PROMPT_RESET_CONTEXT),
      },
      [Default.OBJECTIVE]: {
        name: Default.OBJECTIVE,
        description: "set or update the session objective (1-500 chars) — used for context cleanup classification",
        source: "command",
        get template() {
          return PROMPT_OBJECTIVE
        },
        hints: hints(PROMPT_OBJECTIVE),
      },
      [Default.THREADS]: {
        name: Default.THREADS,
        description: "list side threads for the current project (readonly, output not stored in context)",
        source: "command",
        ephemeral: true,
        get template() {
          return PROMPT_THREADS
        },
        hints: hints(PROMPT_THREADS),
      },
      [Default.HISTORY]: {
        name: Default.HISTORY,
        description: "show linear edit history for this session (readonly, output not stored in context)",
        source: "command",
        ephemeral: true,
        get template() {
          return PROMPT_HISTORY
        },
        hints: hints(PROMPT_HISTORY),
      },
      [Default.TREE]: {
        name: Default.TREE,
        description: "show full edit DAG with branches (readonly, output not stored in context)",
        source: "command",
        ephemeral: true,
        get template() {
          return PROMPT_TREE
        },
        hints: hints(PROMPT_TREE),
      },
      [Default.DEREF]: {
        name: Default.DEREF,
        description: "retrieve externalized content from CAS by hash (readonly, output not stored in context)",
        source: "command",
        ephemeral: true,
        get template() {
          return PROMPT_DEREF
        },
        hints: hints(PROMPT_DEREF),
      },
      [Default.CLASSIFY]: {
        name: Default.CLASSIFY,
        description: "classify messages by topic (readonly, output not stored in context)",
        source: "command",
        ephemeral: true,
        get template() {
          return PROMPT_CLASSIFY
        },
        hints: hints(PROMPT_CLASSIFY),
      },
      [Default.VERIFY]: {
        name: Default.VERIFY,
        description: "verify changes — run test, lint, typecheck with circuit-breaker",
        source: "command",
        get template() {
          return PROMPT_VERIFY
        },
        hints: hints(PROMPT_VERIFY),
      },
    }

    for (const [name, command] of Object.entries(cfg.command ?? {})) {
      result[name] = {
        name,
        agent: command.agent,
        model: command.model,
        description: command.description,
        source: "command",
        get template() {
          return command.template
        },
        subtask: command.subtask,
        ephemeral: command.ephemeral,
        hints: hints(command.template),
      }
    }
    for (const [name, prompt] of Object.entries(await MCP.prompts())) {
      result[name] = {
        name,
        source: "mcp",
        description: prompt.description,
        get template() {
          // since a getter can't be async we need to manually return a promise here
          return new Promise<string>(async (resolve, reject) => {
            const template = await MCP.getPrompt(
              prompt.client,
              prompt.name,
              prompt.arguments
                ? // substitute each argument with $1, $2, etc.
                  Object.fromEntries(prompt.arguments?.map((argument, i) => [argument.name, `$${i + 1}`]))
                : {},
            ).catch(reject)
            resolve(
              template?.messages
                .map((message) => (message.content.type === "text" ? message.content.text : ""))
                .join("\n") || "",
            )
          })
        },
        hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
      }
    }

    for (const skill of await Skill.all()) {
      if (result[skill.name]) continue
      const skillName = skill.name
      result[skillName] = {
        name: skillName,
        description: skill.description,
        source: "skill",
        get template() {
          // Intentionally returns Promise<string> — all consumers (prompt.ts) await the template,
          // and skill commands have hints: [] so no sync hint extraction is needed.
          return Skill.get(skillName).then((s) => s?.content ?? "")
        },
        hints: [],
      }
    }

    return result
  }

  export async function get(name: string, directory: string) {
    return state(directory).then((x) => x[name])
  }

  export async function list(directory: string) {
    return state(directory).then((x) => Object.values(x))
  }
}
