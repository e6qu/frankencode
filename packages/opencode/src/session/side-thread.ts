import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Database, eq, and } from "@/storage/db"
import { SideThreadTable } from "./side-thread.sql"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import z from "zod"

export namespace SideThread {
  const log = Log.create({ service: "side-thread" })

  export const Info = z
    .object({
      id: z.string(),
      projectID: z.string(),
      title: z.string(),
      description: z.string(),
      status: z.enum(["parked", "investigating", "resolved", "deferred"]),
      priority: z.enum(["low", "medium", "high", "critical"]),
      category: z.enum(["bug", "tech-debt", "security", "performance", "test", "other"]),
      sourceSessionID: z.string().optional(),
      sourcePartIDs: z.string().array().optional(),
      casRefs: z.string().array().optional(),
      relatedFiles: z.string().array().optional(),
      createdBy: z.string(),
      timeCreated: z.number(),
      timeUpdated: z.number(),
    })
    .meta({ ref: "SideThread" })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Created: BusEvent.define(
      "side-thread.created",
      z.object({ thread: Info }),
    ),
    Updated: BusEvent.define(
      "side-thread.updated",
      z.object({ thread: Info }),
    ),
  }

  function rowToInfo(row: typeof SideThreadTable.$inferSelect): Info {
    return {
      id: row.id,
      projectID: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status as Info["status"],
      priority: row.priority as Info["priority"],
      category: row.category as Info["category"],
      sourceSessionID: row.source_session_id ?? undefined,
      sourcePartIDs: row.source_part_ids ?? undefined,
      casRefs: row.cas_refs ?? undefined,
      relatedFiles: row.related_files ?? undefined,
      createdBy: row.created_by,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export function create(input: {
    projectID: string
    title: string
    description: string
    priority?: Info["priority"]
    category?: Info["category"]
    sourceSessionID?: string
    sourcePartIDs?: string[]
    casRefs?: string[]
    relatedFiles?: string[]
    createdBy: string
  }): Info {
    const id = "thr_" + Identifier.ascending("part").slice(4) // thr_ prefix
    const now = Date.now()

    Database.use((db) => {
      db.insert(SideThreadTable)
        .values({
          id,
          project_id: input.projectID as any,
          title: input.title,
          description: input.description,
          status: "parked",
          priority: input.priority ?? "medium",
          category: input.category ?? "other",
          source_session_id: input.sourceSessionID ?? null,
          source_part_ids: input.sourcePartIDs ?? null,
          cas_refs: input.casRefs ?? null,
          related_files: input.relatedFiles ?? null,
          created_by: input.createdBy,
        })
        .run()
    })

    const thread: Info = {
      id,
      projectID: input.projectID,
      title: input.title,
      description: input.description,
      status: "parked",
      priority: input.priority ?? "medium",
      category: input.category ?? "other",
      sourceSessionID: input.sourceSessionID,
      sourcePartIDs: input.sourcePartIDs,
      casRefs: input.casRefs,
      relatedFiles: input.relatedFiles,
      createdBy: input.createdBy,
      timeCreated: now,
      timeUpdated: now,
    }

    Database.effect(() => Bus.publish(Event.Created, { thread }))
    log.info("created", { id, title: input.title })
    return thread
  }

  export function get(id: string): Info | null {
    const row = Database.use((db) =>
      db.select().from(SideThreadTable).where(eq(SideThreadTable.id, id)).get(),
    )
    return row ? rowToInfo(row) : null
  }

  export function list(input: {
    projectID: string
    status?: Info["status"] | "all"
  }): Info[] {
    const rows = Database.use((db) => {
      if (input.status && input.status !== "all") {
        return db
          .select()
          .from(SideThreadTable)
          .where(
            and(
              eq(SideThreadTable.project_id, input.projectID as any),
              eq(SideThreadTable.status, input.status),
            ),
          )
          .all()
      }
      return db
        .select()
        .from(SideThreadTable)
        .where(eq(SideThreadTable.project_id, input.projectID as any))
        .all()
    })
    return rows.map(rowToInfo)
  }

  export function update(
    id: string,
    fields: Partial<Pick<Info, "status" | "priority" | "title" | "description">>,
  ): Info | null {
    Database.use((db) => {
      const updates: Record<string, any> = {}
      if (fields.status !== undefined) updates.status = fields.status
      if (fields.priority !== undefined) updates.priority = fields.priority
      if (fields.title !== undefined) updates.title = fields.title
      if (fields.description !== undefined) updates.description = fields.description
      if (Object.keys(updates).length > 0) {
        db.update(SideThreadTable).set(updates).where(eq(SideThreadTable.id, id)).run()
      }
    })

    const updated = get(id)
    if (updated) {
      Database.effect(() => Bus.publish(Event.Updated, { thread: updated }))
      log.info("updated", { id, fields: Object.keys(fields) })
    }
    return updated
  }
}
