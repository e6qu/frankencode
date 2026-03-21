import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { ProviderID, ModelID } from "../../provider/schema"
import { ToolRegistry } from "../../tool/registry"
import { Worktree } from "../../worktree"
import { InstanceALS } from "../../project/instance-als"
import { Project } from "../../project/project"
import { MCP } from "../../mcp"
import { Session } from "../../session"
import { zodToJsonSchema } from "zod-to-json-schema"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { WorkspaceRoutes } from "./workspace"
import { JsonValue } from "@/util/json"
import { SideThread } from "@/session/side-thread"

export const ExperimentalRoutes = lazy(() =>
  new Hono()
    .get(
      "/tool/ids",
      describeRoute({
        summary: "List tool IDs",
        description:
          "Get a list of all available tool IDs, including both built-in tools and dynamically registered tools.",
        operationId: "tool.ids",
        responses: {
          200: {
            description: "Tool IDs",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string()).meta({ ref: "ToolIDs" })),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(await ToolRegistry.ids())
      },
    )
    .get(
      "/tool",
      describeRoute({
        summary: "List tools",
        description:
          "Get a list of available tools with their JSON schema parameters for a specific provider and model combination.",
        operationId: "tool.list",
        responses: {
          200: {
            description: "Tools",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .array(
                      z
                        .object({
                          id: z.string(),
                          description: z.string(),
                          parameters: JsonValue,
                        })
                        .meta({ ref: "ToolListItem" }),
                    )
                    .meta({ ref: "ToolList" }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          provider: z.string(),
          model: z.string(),
        }),
      ),
      async (c) => {
        const { provider, model } = c.req.valid("query")
        const tools = await ToolRegistry.tools({ providerID: ProviderID.make(provider), modelID: ModelID.make(model) })
        return c.json(
          tools.map((t) => ({
            id: t.id,
            description: t.description,
            // Handle both Zod schemas and plain JSON schemas
            // SDK boundary: zodToJsonSchema expects Zod v3 ZodType, but parameters may be Zod v4 or plain JSON schema
            // biome-ignore lint: Zod v3/v4 type incompatibility at library boundary
            parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
          })),
        )
      },
    )
    .route("/workspace", WorkspaceRoutes())
    .post(
      "/worktree",
      describeRoute({
        summary: "Create worktree",
        description: "Create a new git worktree for the current project and run any configured startup scripts.",
        operationId: "worktree.create",
        responses: {
          200: {
            description: "Worktree created",
            content: {
              "application/json": {
                schema: resolver(Worktree.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.create.schema),
      async (c) => {
        const body = c.req.valid("json")
        const worktree = await Worktree.create(body)
        return c.json(worktree)
      },
    )
    .get(
      "/worktree",
      describeRoute({
        summary: "List worktrees",
        description: "List all sandbox worktrees for the current project.",
        operationId: "worktree.list",
        responses: {
          200: {
            description: "List of worktree directories",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string())),
              },
            },
          },
        },
      }),
      async (c) => {
        const projectID = InstanceALS.project.id
        const sandboxes = await Project.sandboxes(projectID)
        return c.json(sandboxes)
      },
    )
    .delete(
      "/worktree",
      describeRoute({
        summary: "Remove worktree",
        description: "Remove a git worktree and delete its branch.",
        operationId: "worktree.remove",
        responses: {
          200: {
            description: "Worktree removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.remove.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.remove(body)
        const projectID = InstanceALS.project.id
        await Project.removeSandbox(projectID, body.directory)
        return c.json(true)
      },
    )
    .post(
      "/worktree/reset",
      describeRoute({
        summary: "Reset worktree",
        description: "Reset a worktree branch to the primary default branch.",
        operationId: "worktree.reset",
        responses: {
          200: {
            description: "Worktree reset",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.reset.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.reset(body)
        return c.json(true)
      },
    )
    .get(
      "/session",
      describeRoute({
        summary: "List sessions",
        description:
          "Get a list of all OpenCode sessions across projects, sorted by most recently updated. Archived sessions are excluded by default.",
        operationId: "experimental.session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.GlobalInfo.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
          roots: z.coerce.boolean().optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          cursor: z.coerce
            .number()
            .optional()
            .meta({ description: "Return sessions updated before this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: z.coerce.number().optional().meta({ description: "Maximum number of sessions to return" }),
          archived: z.coerce.boolean().optional().meta({ description: "Include archived sessions (default false)" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const limit = query.limit ?? 100
        const sessions: Session.GlobalInfo[] = []
        for await (const session of Session.listGlobal({
          directory: query.directory,
          roots: query.roots,
          start: query.start,
          cursor: query.cursor,
          search: query.search,
          limit: limit + 1,
          archived: query.archived,
        })) {
          sessions.push(session)
        }
        const hasMore = sessions.length > limit
        const list = hasMore ? sessions.slice(0, limit) : sessions
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor", String(list[list.length - 1].time.updated))
        }
        return c.json(list)
      },
    )
    .get(
      "/resource",
      describeRoute({
        summary: "Get MCP resources",
        description: "Get all available MCP resources from connected servers. Optionally filter by name.",
        operationId: "experimental.resource.list",
        responses: {
          200: {
            description: "MCP resources",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), MCP.Resource)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await MCP.resources())
      },
    )
    .post(
      "/context/history",
      describeRoute({
        summary: "Get context edit history",
        description: "Get the linear edit history for a session (readonly tool)",
        operationId: "context.history",
        responses: {
          200: {
            description: "Edit history",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    sessionID: z.string(),
                    count: z.number(),
                    nodes: z.array(
                      z.object({
                        id: z.string(),
                        parentID: z.string().nullable(),
                        partID: z.string(),
                        operation: z.string(),
                        casHash: z.string().nullable(),
                        agent: z.string(),
                        timeCreated: z.number(),
                      }),
                    ),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const { sessionID } = c.req.valid("json")
        const { EditGraph } = await import("../../cas/graph")
        const nodes = EditGraph.getLog(sessionID)
        return c.json({
          sessionID,
          count: nodes.length,
          nodes: nodes.map((n) => ({
            id: n.id,
            parentID: n.parent_id,
            partID: n.part_id,
            operation: n.operation,
            casHash: n.cas_hash,
            agent: n.agent,
            timeCreated: n.time_created,
          })),
        })
      },
    )
    .post(
      "/context/tree",
      describeRoute({
        summary: "Get context edit tree",
        description: "Get the full edit DAG with branches for a session (readonly tool)",
        operationId: "context.tree",
        responses: {
          200: {
            description: "Edit tree",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    sessionID: z.string(),
                    head: z.string().nullable(),
                    branches: z.record(z.string(), z.string()),
                    count: z.number(),
                    nodes: z.array(
                      z.object({
                        id: z.string(),
                        parentID: z.string().nullable(),
                        partID: z.string(),
                        operation: z.string(),
                        casHash: z.string().nullable(),
                        agent: z.string(),
                        timeCreated: z.number(),
                      }),
                    ),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const { sessionID } = c.req.valid("json")
        const { EditGraph } = await import("../../cas/graph")
        const { nodes, head, branches } = EditGraph.tree(sessionID)
        return c.json({
          sessionID,
          head,
          branches,
          count: nodes.length,
          nodes: nodes.map((n) => ({
            id: n.id,
            parentID: n.parent_id,
            partID: n.part_id,
            operation: n.operation,
            casHash: n.cas_hash,
            agent: n.agent,
            timeCreated: n.time_created,
          })),
        })
      },
    )
    .post(
      "/context/threads",
      describeRoute({
        summary: "List side threads",
        description: "List side threads for the current project (readonly tool)",
        operationId: "context.threads",
        responses: {
          200: {
            description: "Side threads",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    projectID: z.string(),
                    threads: z.array(SideThread.Info),
                    total: z.number(),
                    hasMore: z.boolean(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          status: z.enum(["parked", "investigating", "resolved", "deferred", "all"]).default("all"),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }),
      ),
      async (c) => {
        const { status, limit, offset } = c.req.valid("json")
        const { SideThread } = await import("../../session/side-thread")
        const projectID = InstanceALS.project.id
        const result = SideThread.list({
          projectID,
          status: status as "parked" | "investigating" | "resolved" | "deferred" | "all",
          limit,
          offset,
        })
        return c.json({
          projectID,
          ...result,
        })
      },
    )
    .post(
      "/context/deref",
      describeRoute({
        summary: "Retrieve CAS content",
        description: "Retrieve externalized content from CAS by hash (readonly tool)",
        operationId: "context.deref",
        responses: {
          200: {
            description: "CAS content",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    hash: z.string(),
                    content: z.string(),
                    timeCreated: z.number(),
                  }),
                ),
              },
            },
          },
          404: {
            description: "CAS entry not found",
          },
        },
      }),
      validator(
        "json",
        z.object({
          hash: z.string(),
        }),
      ),
      async (c) => {
        const { hash } = c.req.valid("json")
        const { CAS } = await import("../../cas")
        const entry = CAS.get(hash)
        if (!entry) {
          return c.json({ error: "CAS entry not found" }, 404)
        }
        return c.json({
          hash,
          content: entry.content,
          timeCreated: entry.time_created,
        })
      },
    ),
)
