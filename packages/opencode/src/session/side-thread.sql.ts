import { sqliteTable, text, index } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { Timestamps } from "../storage/schema.sql"
import type { ProjectID } from "../project/schema"

export const SideThreadTable = sqliteTable(
  "side_thread",
  {
    id: text().primaryKey(),
    project_id: text()
      .$type<ProjectID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull(),
    status: text()
      .notNull()
      .$default(() => "parked"),
    priority: text()
      .notNull()
      .$default(() => "medium"),
    category: text()
      .notNull()
      .$default(() => "other"),
    source_session_id: text(),
    source_part_ids: text({ mode: "json" }).$type<string[]>(),
    cas_refs: text({ mode: "json" }).$type<string[]>(),
    related_files: text({ mode: "json" }).$type<string[]>(),
    created_by: text().notNull(),
    ...Timestamps,
  },
  (table) => [index("side_thread_project_idx").on(table.project_id, table.status)],
)
