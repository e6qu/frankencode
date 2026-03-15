import { createHash } from "crypto"
import { Database, eq } from "@/storage/db"
import { CASObjectTable } from "./cas.sql"
import { Token } from "@/util/token"
import { Log } from "@/util/log"

export namespace CAS {
  const log = Log.create({ service: "cas" })

  export interface Entry {
    hash: string
    content: string
    content_type: string
    tokens: number
    session_id: string | null
    message_id: string | null
    part_id: string | null
    time_created: number
    time_updated: number
  }

  export function hash(content: string): string {
    return createHash("sha256").update(content).digest("hex")
  }

  /**
   * Store content in the CAS. Returns the SHA-256 hash.
   * Idempotent: same content always produces the same hash; duplicate inserts are no-ops.
   */
  export function store(
    content: string,
    meta: {
      contentType: string
      sessionID?: string
      messageID?: string
      partID?: string
    },
  ): string {
    const h = hash(content)
    Database.use((db) => {
      db.insert(CASObjectTable)
        .values({
          hash: h,
          content,
          content_type: meta.contentType,
          tokens: Token.estimate(content),
          session_id: meta.sessionID ?? null,
          message_id: meta.messageID ?? null,
          part_id: meta.partID ?? null,
        })
        .onConflictDoNothing()
        .run()
    })
    log.info("stored", { hash: h.slice(0, 12), contentType: meta.contentType })
    return h
  }

  /**
   * Retrieve content by hash. Returns null if not found.
   */
  export function get(h: string): Entry | null {
    return (
      Database.use((db) => db.select().from(CASObjectTable).where(eq(CASObjectTable.hash, h)).get()) ?? null
    )
  }

  /**
   * Check if a hash exists in the CAS.
   */
  export function exists(h: string): boolean {
    return !!Database.use((db) =>
      db
        .select({ hash: CASObjectTable.hash })
        .from(CASObjectTable)
        .where(eq(CASObjectTable.hash, h))
        .get(),
    )
  }

  /**
   * List all CAS entries for a session.
   */
  export function listBySession(sessionID: string): Entry[] {
    return Database.use((db) =>
      db.select().from(CASObjectTable).where(eq(CASObjectTable.session_id, sessionID)).all(),
    )
  }
}
