import { Storage } from "@/storage/storage"
import { MessageV2 } from "./message-v2"
import { Log } from "@/util/log"

export namespace Objective {
  const log = Log.create({ service: "objective" })

  /**
   * Get the tracked objective for a session. Returns null if none set.
   */
  export async function get(sessionID: string): Promise<string | null> {
    try {
      const data = await Storage.read<{ objective: string }>(["objective", sessionID])
      return data.objective
    } catch {
      return null
    }
  }

  /**
   * Set/update the objective for a session.
   */
  export async function set(sessionID: string, objective: string): Promise<void> {
    await Storage.write(["objective", sessionID], { objective, updatedAt: Date.now() })
    log.info("set", { sessionID, objective: objective.slice(0, 80) })
  }

  /**
   * Extract the objective from the first user message in a conversation.
   * Caches the result so subsequent calls return immediately.
   */
  export async function extract(sessionID: string, messages: MessageV2.WithParts[]): Promise<string | null> {
    // Check cache first
    const cached = await get(sessionID)
    if (cached) return cached

    // Find the first user message with text
    for (const msg of messages) {
      if (msg.info.role !== "user") continue
      for (const part of msg.parts) {
        if (part.type === "text" && part.text?.trim()) {
          // Use the first user message text as the objective
          // Truncate to a reasonable length
          const objective = part.text.trim().slice(0, 500)
          await set(sessionID, objective)
          return objective
        }
      }
    }

    return null
  }
}
