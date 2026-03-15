import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const CASObjectTable = sqliteTable(
  "cas_object",
  {
    hash: text().primaryKey(),
    content: text().notNull(),
    content_type: text().notNull(),
    tokens: integer().notNull(),
    session_id: text(),
    message_id: text(),
    part_id: text(),
    ...Timestamps,
  },
  (table) => [index("cas_object_session_idx").on(table.session_id)],
)

export const EditGraphNodeTable = sqliteTable(
  "edit_graph_node",
  {
    id: text().primaryKey(),
    parent_id: text(),
    session_id: text().notNull(),
    part_id: text().notNull(),
    operation: text().notNull(),
    cas_hash: text(),
    agent: text().notNull(),
    ...Timestamps,
  },
  (table) => [
    index("edit_graph_session_idx").on(table.session_id),
    index("edit_graph_parent_idx").on(table.parent_id),
  ],
)

export const EditGraphHeadTable = sqliteTable("edit_graph_head", {
  session_id: text().primaryKey(),
  node_id: text().notNull(),
  branches: text({ mode: "json" }).$type<Record<string, string>>(),
})
