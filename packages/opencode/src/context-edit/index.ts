import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { SessionID, MessageID, PartID } from "@/session/schema"
import { CAS } from "@/cas"
import { EditGraph } from "@/cas/graph"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Database } from "@/storage/db"
import { Plugin } from "@/plugin"
import { InstanceALS } from "@/project/instance-als"
import { Log } from "@/util/log"
import { Token } from "@/util/token"
import z from "zod"

export namespace ContextEdit {
  const log = Log.create({ service: "context-edit" })

  // ── Constants ──────────────────────────────────────────

  const MAX_HIDDEN_RATIO = 0.7
  const PROTECTED_RECENT_TURNS = 2
  const PROTECTED_TOOLS = ["skill"]
  const PRIVILEGED_AGENTS = ["focus", "compaction"]

  async function pluginGuard(
    op: string,
    input: { sessionID: string; partID?: string; messageID?: string; agent: string },
  ): Promise<EditResult | null> {
    try {
      const result = await Plugin.trigger(
        "context.edit.before",
        {
          operation: op,
          sessionID: input.sessionID,
          partID: input.partID,
          messageID: input.messageID,
          agent: input.agent,
        },
        { allow: true, reason: undefined },
        InstanceALS.directory,
      )
      if (!result.allow) return { success: false, error: result.reason ?? "Blocked by plugin" }
      return null
    } catch (e) {
      log.error("plugin guard error", { op, error: e instanceof Error ? e.message : String(e) })
      return { success: false, error: `Plugin error: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  async function pluginNotify(
    op: string,
    input: { sessionID: string; partID?: string; messageID?: string; agent: string },
    success: boolean,
  ) {
    try {
      await Plugin.trigger(
        "context.edit.after",
        {
          operation: op,
          sessionID: input.sessionID,
          partID: input.partID,
          messageID: input.messageID,
          agent: input.agent,
          success,
        },
        {},
        InstanceALS.directory,
      )
    } catch (e) {
      log.warn("plugin notify error", { op, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // ── Types ──────────────────────────────────────────────

  export interface EditResult {
    success: boolean
    casHash?: string
    newPartID?: string
    error?: string
  }

  // ── Events ─────────────────────────────────────────────

  export const Event = {
    PartHidden: BusEvent.define(
      "context.edit.hidden",
      z.object({
        sessionID: z.string(),
        partID: z.string(),
        casHash: z.string(),
        agent: z.string(),
      }),
    ),
    PartUnhidden: BusEvent.define(
      "context.edit.unhidden",
      z.object({
        sessionID: z.string(),
        partID: z.string(),
        agent: z.string(),
      }),
    ),
    PartReplaced: BusEvent.define(
      "context.edit.replaced",
      z.object({
        sessionID: z.string(),
        oldPartID: z.string(),
        newPartID: z.string(),
        casHash: z.string(),
        agent: z.string(),
      }),
    ),
    PartAnnotated: BusEvent.define(
      "context.edit.annotated",
      z.object({
        sessionID: z.string(),
        partID: z.string(),
        annotation: z.string(),
        agent: z.string(),
      }),
    ),
    ContentExternalized: BusEvent.define(
      "context.edit.externalized",
      z.object({
        sessionID: z.string(),
        partID: z.string(),
        casHash: z.string(),
        agent: z.string(),
      }),
    ),
  }

  // ── Validation ─────────────────────────────────────────

  function validateOwnership(agent: string, message: MessageV2.Info): string | null {
    if (PRIVILEGED_AGENTS.includes(agent)) return null
    if (message.role === "user") return "Cannot edit user messages"
    if (message.agent !== agent) return `Cannot edit messages from agent '${message.agent}'`
    return null
  }

  function validateBudget(messages: MessageV2.WithParts[]): string | null {
    const totalParts = messages.reduce((n, m) => n + m.parts.length, 0)
    const hiddenParts = messages.reduce((n, m) => n + m.parts.filter((p) => p.edit?.hidden).length, 0)
    if (totalParts > 0 && (hiddenParts + 1) / totalParts > MAX_HIDDEN_RATIO)
      return `Cannot hide more than ${MAX_HIDDEN_RATIO * 100}% of all parts`
    return null
  }

  function isProtectedMessage(messages: MessageV2.WithParts[], messageID: string): boolean {
    const idx = messages.findIndex((m) => m.info.id === messageID)
    if (idx < 0) return true
    return idx >= messages.length - PROTECTED_RECENT_TURNS * 2
  }

  function findPart(msg: MessageV2.WithParts, partID: string): MessageV2.Part | undefined {
    return msg.parts.find((p) => p.id === partID)
  }

  function getPartContent(part: MessageV2.Part): string {
    if ("text" in part && typeof part.text === "string") return part.text
    if (part.type === "tool") {
      const state = (part as MessageV2.ToolPart).state
      if (state.status === "completed") return state.output ?? ""
      return JSON.stringify(state.input ?? {})
    }
    return JSON.stringify(part)
  }

  // ── Operations ─────────────────────────────────────────

  export async function hide(input: {
    sessionID: string
    partID: string
    messageID: string
    agent: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("hide", input)
    if (blocked) return blocked

    const msg = await MessageV2.get({
      sessionID: SessionID.make(input.sessionID),
      messageID: MessageID.make(input.messageID),
    })
    if (!msg) return { success: false, error: "Message not found" }

    const ownerErr = validateOwnership(input.agent, msg.info)
    if (ownerErr) return { success: false, error: ownerErr }

    const messages = await Session.messages({ sessionID: SessionID.make(input.sessionID) })
    if (isProtectedMessage(messages, input.messageID))
      return { success: false, error: "Cannot edit recent messages (last 2 turns are protected)" }

    const part = findPart(msg, input.partID)
    if (!part) return { success: false, error: "Part not found" }
    if (part.type === "tool" && PROTECTED_TOOLS.includes((part as MessageV2.ToolPart).tool))
      return { success: false, error: `Cannot hide protected tool: ${(part as MessageV2.ToolPart).tool}` }

    const budgetErr = validateBudget(messages)
    if (budgetErr) return { success: false, error: budgetErr }

    let casHash: string

    Database.transaction(() => {
      casHash = CAS.store(JSON.stringify(part), {
        contentType: part.type === "tool" ? "tool-output" : part.type,
        sessionID: input.sessionID,
        messageID: input.messageID,
        partID: input.partID,
        tokens: Token.estimate(getPartContent(part)),
      })

      const version = EditGraph.commit({
        sessionID: input.sessionID,
        partID: input.partID,
        operation: "hide",
        casHash: casHash!,
        agent: input.agent,
      })

      Session.updatePart({
        ...part,
        edit: {
          hidden: true,
          casHash: casHash!,
          editedAt: Date.now(),
          editedBy: input.agent,
          version,
        },
      })

      Database.effect(() =>
        Bus.publish(
          Event.PartHidden,
          {
            sessionID: input.sessionID,
            partID: input.partID,
            casHash: casHash!,
            agent: input.agent,
          },
          InstanceALS.directory,
        ),
      )
    })

    log.info("hidden", { partID: input.partID, casHash: casHash! })
    await pluginNotify("hide", input, true)
    return { success: true, casHash: casHash! }
  }

  export async function unhide(input: {
    sessionID: string
    partID: string
    messageID: string
    agent: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("unhide", input)
    if (blocked) return blocked

    const msg = await MessageV2.get({
      sessionID: SessionID.make(input.sessionID),
      messageID: MessageID.make(input.messageID),
    })
    if (!msg) return { success: false, error: "Message not found" }

    const part = findPart(msg, input.partID)
    if (!part) return { success: false, error: "Part not found" }
    if (!part.edit?.hidden) return { success: false, error: "Part is not hidden" }

    Database.transaction(() => {
      Session.updatePart({
        ...part,
        edit: undefined,
      })

      Database.effect(() =>
        Bus.publish(
          Event.PartUnhidden,
          {
            sessionID: input.sessionID,
            partID: input.partID,
            agent: input.agent,
          },
          InstanceALS.directory,
        ),
      )
    })

    log.info("unhidden", { partID: input.partID })
    await pluginNotify("unhide", input, true)
    return { success: true }
  }

  export async function replace(input: {
    sessionID: string
    partID: string
    messageID: string
    agent: string
    replacement: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("replace", input)
    if (blocked) return blocked

    const msg = await MessageV2.get({
      sessionID: SessionID.make(input.sessionID),
      messageID: MessageID.make(input.messageID),
    })
    if (!msg) return { success: false, error: "Message not found" }

    const ownerErr = validateOwnership(input.agent, msg.info)
    if (ownerErr) return { success: false, error: ownerErr }

    const messages = await Session.messages({ sessionID: SessionID.make(input.sessionID) })
    if (isProtectedMessage(messages, input.messageID))
      return { success: false, error: "Cannot edit recent messages (last 2 turns are protected)" }

    const part = findPart(msg, input.partID)
    if (!part) return { success: false, error: "Part not found" }

    const newPartID = PartID.ascending()
    let casHash: string

    Database.transaction(() => {
      casHash = CAS.store(JSON.stringify(part), {
        contentType: part.type === "tool" ? "tool-output" : part.type,
        sessionID: input.sessionID,
        messageID: input.messageID,
        partID: input.partID,
        tokens: Token.estimate(getPartContent(part)),
      })

      const version = EditGraph.commit({
        sessionID: input.sessionID,
        partID: input.partID,
        operation: "replace",
        casHash: casHash!,
        agent: input.agent,
      })

      // Hide original with pointer to replacement
      Session.updatePart({
        ...part,
        edit: {
          hidden: true,
          casHash: casHash!,
          supersededBy: newPartID,
          editedAt: Date.now(),
          editedBy: input.agent,
          version,
        },
      })

      // Insert replacement
      Session.updatePart({
        id: newPartID,
        sessionID: SessionID.make(input.sessionID),
        messageID: MessageID.make(input.messageID),
        type: "text",
        text: input.replacement,
        edit: {
          hidden: false,
          replacementOf: input.partID,
          editedAt: Date.now(),
          editedBy: input.agent,
          version,
        },
      })

      Database.effect(() =>
        Bus.publish(
          Event.PartReplaced,
          {
            sessionID: input.sessionID,
            oldPartID: input.partID,
            newPartID,
            casHash: casHash!,
            agent: input.agent,
          },
          InstanceALS.directory,
        ),
      )
    })

    log.info("replaced", { oldPartID: input.partID, newPartID, casHash: casHash! })
    await pluginNotify("replace", input, true)
    return { success: true, casHash: casHash!, newPartID }
  }

  export async function annotate(input: {
    sessionID: string
    partID: string
    messageID: string
    agent: string
    annotation: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("annotate", input)
    if (blocked) return blocked

    const msg = await MessageV2.get({
      sessionID: SessionID.make(input.sessionID),
      messageID: MessageID.make(input.messageID),
    })
    if (!msg) return { success: false, error: "Message not found" }

    const part = findPart(msg, input.partID)
    if (!part) return { success: false, error: "Part not found" }

    Database.transaction(() => {
      const version = EditGraph.commit({
        sessionID: input.sessionID,
        partID: input.partID,
        operation: "annotate",
        agent: input.agent,
      })

      Session.updatePart({
        ...part,
        edit: {
          ...(part.edit ?? { hidden: false, editedAt: 0, editedBy: "" }),
          hidden: part.edit?.hidden ?? false,
          annotation: input.annotation,
          editedAt: Date.now(),
          editedBy: input.agent,
          version,
        },
      })

      Database.effect(() =>
        Bus.publish(
          Event.PartAnnotated,
          {
            sessionID: input.sessionID,
            partID: input.partID,
            annotation: input.annotation,
            agent: input.agent,
          },
          InstanceALS.directory,
        ),
      )
    })

    log.info("annotated", { partID: input.partID })
    await pluginNotify("annotate", input, true)
    return { success: true }
  }

  export async function externalize(input: {
    sessionID: string
    partID: string
    messageID: string
    agent: string
    summary: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("externalize", input)
    if (blocked) return blocked

    const msg = await MessageV2.get({
      sessionID: SessionID.make(input.sessionID),
      messageID: MessageID.make(input.messageID),
    })
    if (!msg) return { success: false, error: "Message not found" }

    const ownerErr = validateOwnership(input.agent, msg.info)
    if (ownerErr) return { success: false, error: ownerErr }

    const messages = await Session.messages({ sessionID: SessionID.make(input.sessionID) })
    if (isProtectedMessage(messages, input.messageID))
      return { success: false, error: "Cannot edit recent messages (last 2 turns are protected)" }

    const part = findPart(msg, input.partID)
    if (!part) return { success: false, error: "Part not found" }

    let casHash: string

    Database.transaction(() => {
      casHash = CAS.store(JSON.stringify(part), {
        contentType: part.type === "tool" ? "tool-output" : part.type,
        sessionID: input.sessionID,
        messageID: input.messageID,
        partID: input.partID,
        tokens: Token.estimate(getPartContent(part)),
      })

      const version = EditGraph.commit({
        sessionID: input.sessionID,
        partID: input.partID,
        operation: "externalize",
        casHash: casHash!,
        agent: input.agent,
      })

      // Replace inline content with compact summary + hash reference
      const summaryText = `[Externalized: ${input.summary}. Use context_deref("${casHash!}") to retrieve full content (${CAS.get(casHash!)?.tokens ?? "?"} tokens).]`

      if (part.type === "text") {
        Session.updatePart({
          ...part,
          text: summaryText,
          edit: {
            hidden: false,
            casHash: casHash!,
            annotation: input.summary,
            editedAt: Date.now(),
            editedBy: input.agent,
            version,
          },
        })
      } else if (part.type === "tool") {
        const toolPart = part as MessageV2.ToolPart
        if (toolPart.state.status === "completed") {
          Session.updatePart({
            ...toolPart,
            state: {
              ...toolPart.state,
              output: summaryText,
            },
            edit: {
              hidden: false,
              casHash: casHash!,
              annotation: input.summary,
              editedAt: Date.now(),
              editedBy: input.agent,
              version,
            },
          })
        }
      } else {
        // For other part types, hide and create a text replacement
        const newPartID = PartID.ascending()
        Session.updatePart({
          ...part,
          edit: {
            hidden: true,
            casHash: casHash!,
            supersededBy: newPartID,
            editedAt: Date.now(),
            editedBy: input.agent,
            version,
          },
        })
        Session.updatePart({
          id: newPartID,
          sessionID: SessionID.make(input.sessionID),
          messageID: MessageID.make(input.messageID),
          type: "text",
          text: summaryText,
          edit: {
            hidden: false,
            replacementOf: input.partID,
            editedAt: Date.now(),
            editedBy: input.agent,
            version,
          },
        })
      }

      Database.effect(() =>
        Bus.publish(
          Event.ContentExternalized,
          {
            sessionID: input.sessionID,
            partID: input.partID,
            casHash: casHash!,
            agent: input.agent,
          },
          InstanceALS.directory,
        ),
      )
    })

    log.info("externalized", { partID: input.partID, casHash: casHash! })
    await pluginNotify("externalize", input, true)
    return { success: true, casHash: casHash! }
  }

  export async function mark(input: {
    sessionID: string
    partID: string
    messageID: string
    agent: string
    hint: "discardable" | "ephemeral" | "side-thread" | "pinned"
    afterTurns?: number
    reason?: string
    currentTurn: number
  }): Promise<EditResult> {
    const msg = await MessageV2.get({
      sessionID: SessionID.make(input.sessionID),
      messageID: MessageID.make(input.messageID),
    })
    if (!msg) return { success: false, error: "Message not found" }

    const part = findPart(msg, input.partID)
    if (!part) return { success: false, error: "Part not found" }

    Database.transaction(() => {
      Session.updatePart({
        ...part,
        lifecycle: {
          hint: input.hint,
          afterTurns:
            input.afterTurns ?? (input.hint === "discardable" ? 3 : input.hint === "ephemeral" ? 5 : undefined),
          reason: input.reason,
          setAt: Date.now(),
          setBy: input.agent,
          turnWhenSet: input.currentTurn,
        },
      })
    })

    log.info("marked", { partID: input.partID, hint: input.hint })
    return { success: true }
  }

  /**
   * Deterministic sweeper: processes lifecycle markers without LLM calls.
   * Call from the prompt loop after filterEdited().
   *
   * Note: Sweeper actions ARE tracked in the EditGraph, making them reversible via checkout.
   */
  export function sweep(messages: MessageV2.WithParts[], currentTurn: number): MessageV2.WithParts[] {
    let changed = false
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (!part.lifecycle) continue
        if (part.lifecycle.hint === "pinned") continue
        if (part.lifecycle.hint === "ephemeral") continue // ephemeral parts are filtered upstream
        if (part.edit?.hidden) continue

        const turns = part.lifecycle.afterTurns
        if (turns == null) continue
        const turnWhenSet = part.lifecycle.turnWhenSet
        if (turnWhenSet == null) continue
        const elapsed = currentTurn - turnWhenSet
        if (elapsed < turns) continue

        const lifecycle = part.lifecycle
        if (lifecycle.hint === "discardable") {
          try {
            Database.transaction(() => {
              const casHash = CAS.store(JSON.stringify(part), {
                contentType: part.type === "tool" ? "tool-output" : part.type,
                sessionID: msg.info.sessionID,
                partID: part.id,
                tokens: Token.estimate(getPartContent(part)),
              })

              // Track in EditGraph for reversibility
              const version = EditGraph.commit({
                sessionID: msg.info.sessionID,
                partID: part.id,
                operation: "sweep-discard",
                casHash,
                agent: "sweeper",
              })

              Session.updatePart({
                ...part,
                edit: {
                  hidden: true,
                  casHash,
                  editedAt: Date.now(),
                  editedBy: "sweeper",
                  version,
                },
              })
              log.info("swept discardable", {
                partID: part.id.slice(0, 12),
                reason: lifecycle.reason ?? null,
                casHash: casHash.slice(0, 12),
              })
            })
            changed = true
          } catch (e) {
            log.error("sweep transaction failed", {
              partID: part.id.slice(0, 12),
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
      }
    }
    return changed ? MessageV2.filterEdited(messages) : messages
  }

  export interface ResetResult {
    restored: number
    removed: number
    failed: number
    errors: Array<{ partID: string; reason: string }>
  }

  export async function reset(sessionID: string): Promise<ResetResult> {
    const messages = await Session.messages({ sessionID: SessionID.make(sessionID) })
    let restored = 0
    let removed = 0
    let failed = 0
    const errors: Array<{ partID: string; reason: string }> = []

    for (const msg of messages) {
      for (const part of msg.parts) {
        if (!part.edit) continue

        // Replacement parts get removed (they were created by replace/externalize)
        if (part.edit.replacementOf) {
          Session.updatePart({ ...part, edit: undefined })
          removed++
          continue
        }

        // Original parts get restored from CAS
        if (part.edit.casHash) {
          const entry = CAS.get(part.edit.casHash)
          if (!entry) {
            failed++
            errors.push({
              partID: part.id,
              reason: `CAS entry not found: ${part.edit.casHash.slice(0, 12)}...`,
            })
            continue
          }

          try {
            const original = JSON.parse(entry.content)
            Session.updatePart({
              ...original,
              id: part.id,
              sessionID: part.sessionID,
              messageID: part.messageID,
              edit: undefined,
              lifecycle: undefined,
            })
            restored++
          } catch (e) {
            failed++
            errors.push({
              partID: part.id,
              reason: `Failed to parse CAS content: ${e instanceof Error ? e.message : String(e)}`,
            })
          }
        } else {
          // Parts with edits but no CAS (e.g., just annotated) get cleared
          Session.updatePart({ ...part, edit: undefined, lifecycle: undefined })
          restored++
        }
      }
    }

    log.info("reset", { sessionID: sessionID.slice(0, 12), restored, removed, failed })
    return { restored, removed, failed, errors }
  }
}
