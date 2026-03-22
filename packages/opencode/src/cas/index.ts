import { createHash } from "crypto"
import { Database, eq, and, lt, isNull, not, inArray, sql } from "@/storage/db"
import { CASObjectTable, EditGraphNodeTable } from "./cas.sql"
import { SessionTable } from "@/session/session.sql"
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
      tokens?: number
    },
  ): string {
    const h = hash(content)
    Database.use((db) => {
      db.insert(CASObjectTable)
        .values({
          hash: h,
          content,
          content_type: meta.contentType,
          tokens: meta.tokens ?? Token.estimate(content),
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
    return Database.use((db) => db.select().from(CASObjectTable).where(eq(CASObjectTable.hash, h)).get()) ?? null
  }

  /**
   * Check if a hash exists in the CAS.
   */
  export function exists(h: string): boolean {
    return !!Database.use((db) =>
      db.select({ hash: CASObjectTable.hash }).from(CASObjectTable).where(eq(CASObjectTable.hash, h)).get(),
    )
  }

  /**
   * List all CAS entries for a session.
   */
  export function listBySession(sessionID: string): Entry[] {
    return Database.use((db) => db.select().from(CASObjectTable).where(eq(CASObjectTable.session_id, sessionID)).all())
  }

  /**
   * Delete all CAS entries for a session. Called when a session is deleted.
   * Returns the number of entries deleted.
   */
  export function deleteBySession(sessionID: string): number {
    let count = 0
    Database.transaction((db) => {
      const entries = db
        .select({ hash: CASObjectTable.hash })
        .from(CASObjectTable)
        .where(eq(CASObjectTable.session_id, sessionID))
        .all()
      if (entries.length === 0) return
      db.delete(CASObjectTable).where(eq(CASObjectTable.session_id, sessionID)).run()
      count = entries.length
    })
    if (count > 0) {
      log.info("deleted by session", { sessionID: sessionID.slice(0, 12), count })
    }
    return count
  }

  /**
   * Delete CAS entries where the session no longer exists and the entry is older than cutoff.
   * Returns the number of entries deleted.
   */
  export function deleteOrphans(olderThanDays: number = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    let totalDeleted = 0

    // 1. Delete entries with null session_id (older than cutoff)
    const nullSessionEntries = Database.use((db) =>
      db
        .select({ hash: CASObjectTable.hash })
        .from(CASObjectTable)
        .where(and(isNull(CASObjectTable.session_id), lt(CASObjectTable.time_created, cutoff)))
        .all(),
    )
    if (nullSessionEntries.length > 0) {
      // Only delete CAS entries not referenced by any EditGraphNode
      const referencedHashes = new Set(
        Database.use((db) =>
          db
            .select({ cas_hash: EditGraphNodeTable.cas_hash })
            .from(EditGraphNodeTable)
            .where(
              inArray(
                EditGraphNodeTable.cas_hash,
                nullSessionEntries.map((e) => e.hash),
              ),
            )
            .all(),
        )
          .map((r) => r.cas_hash)
          .filter(Boolean),
      )
      const safeToDel = nullSessionEntries.filter((e) => !referencedHashes.has(e.hash))
      if (safeToDel.length > 0) {
        const hashes = safeToDel.map((e) => e.hash)
        Database.use((db) => db.delete(CASObjectTable).where(inArray(CASObjectTable.hash, hashes)).run())
        totalDeleted += safeToDel.length
      }
      log.info("deleted orphans (null session)", { count: safeToDel.length, olderThanDays })
    }

    // 2. Delete entries referencing non-existent sessions (older than cutoff)
    // Get all entries with session_id older than cutoff
    const entriesWithSession = Database.use((db) =>
      db
        .select({ hash: CASObjectTable.hash, session_id: CASObjectTable.session_id })
        .from(CASObjectTable)
        .where(and(not(isNull(CASObjectTable.session_id)), lt(CASObjectTable.time_created, cutoff)))
        .all(),
    )

    if (entriesWithSession.length === 0) return totalDeleted

    // Get all existing session IDs
    const existingSessions = new Set(
      Database.use((db) => db.select({ id: SessionTable.id }).from(SessionTable).all()).map((s) => s.id as string),
    )

    // Find entries with non-existent sessions
    const orphans = entriesWithSession.filter((e) => !existingSessions.has(e.session_id!))
    if (orphans.length > 0) {
      // Only delete CAS entries not referenced by any EditGraphNode (across all sessions)
      const orphanHashes = orphans.map((e) => e.hash)
      const referencedOrphanHashes = new Set<string>()
      const batchSize = 100
      for (let i = 0; i < orphanHashes.length; i += batchSize) {
        const batch = orphanHashes.slice(i, i + batchSize)
        const refs = Database.use((db) =>
          db
            .select({ cas_hash: EditGraphNodeTable.cas_hash })
            .from(EditGraphNodeTable)
            .where(inArray(EditGraphNodeTable.cas_hash, batch))
            .all(),
        )
        for (const r of refs) {
          if (r.cas_hash) referencedOrphanHashes.add(r.cas_hash)
        }
      }
      const safeToDel = orphanHashes.filter((h) => !referencedOrphanHashes.has(h))
      // Delete in batches of 100 to avoid SQL parameter limits
      for (let i = 0; i < safeToDel.length; i += batchSize) {
        const batch = safeToDel.slice(i, i + batchSize)
        Database.use((db) => db.delete(CASObjectTable).where(inArray(CASObjectTable.hash, batch)).run())
      }
      totalDeleted += safeToDel.length
      log.info("deleted orphans (missing session)", { count: safeToDel.length, olderThanDays })
    }

    return totalDeleted
  }

  /**
   * Run garbage collection. Should be called periodically (e.g., on app start).
   */
  export async function runGC(options?: { olderThanDays?: number }): Promise<{ deleted: number }> {
    const olderThanDays = options?.olderThanDays ?? 30
    log.info("gc starting", { olderThanDays })
    const deleted = deleteOrphans(olderThanDays)
    log.info("gc complete", { deleted })
    return { deleted }
  }
}
