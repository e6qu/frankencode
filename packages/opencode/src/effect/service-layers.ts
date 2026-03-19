/**
 * Service layer definitions for modules that use the registerDisposer pattern.
 *
 * These service classes are defined here (rather than in their respective modules)
 * to avoid changing the import graph of the original modules. Adding
 * `import { Effect, Layer, ServiceMap } from "effect"` to those modules changes
 * Bun's module evaluation order and breaks existing circular dependency chains.
 *
 * ALL imports of application modules use dynamic import() inside layer bodies
 * to avoid pulling those modules into the static import graph of instances.ts.
 */

import { Effect, Layer, ServiceMap } from "effect"
import { InstanceContext } from "./instance-context"

// Type-only imports for service interfaces (erased at runtime, no circular dep impact)
import type { Config } from "@/config/config"
import type { Agent } from "@/agent/agent"
import type { Command } from "@/command"
import type { Provider } from "@/provider/provider"
import type { Pty } from "@/pty"
import type { MCP } from "@/mcp"

// ---------------------------------------------------------------------------
// ConfigService
// ---------------------------------------------------------------------------

export namespace ConfigService {
  export interface Service {
    readonly get: () => Effect.Effect<Config.Info>
  }
}

export class ConfigService extends ServiceMap.Service<ConfigService, ConfigService.Service>()("@opencode/Config") {
  static readonly layer = Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { Config, configStates } = yield* Effect.promise(() => import("@/config/config"))
      yield* Effect.promise(() => Config.get())
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          configStates.delete(dir)
        }),
      )
      return ConfigService.of({
        get: () => Effect.promise(() => Config.get()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// PluginService
// ---------------------------------------------------------------------------

export namespace PluginService {
  export interface Service {
    readonly init: () => Effect.Effect<void>
  }
}

export class PluginService extends ServiceMap.Service<PluginService, PluginService.Service>()("@opencode/Plugin") {
  static readonly layer = Layer.effect(
    PluginService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { Plugin, pluginStates } = yield* Effect.promise(() => import("@/plugin"))
      yield* Effect.promise(() => Plugin.init())
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          pluginStates.delete(dir)
        }),
      )
      return PluginService.of({
        init: () => Effect.promise(() => Plugin.init()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// ToolRegistryService
// ---------------------------------------------------------------------------

export namespace ToolRegistryService {
  export interface Service {
    readonly ids: () => Effect.Effect<string[]>
  }
}

export class ToolRegistryService extends ServiceMap.Service<ToolRegistryService, ToolRegistryService.Service>()(
  "@opencode/ToolRegistry",
) {
  static readonly layer = Layer.effect(
    ToolRegistryService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { ToolRegistry, toolRegistryStates } = yield* Effect.promise(() => import("@/tool/registry"))
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          toolRegistryStates.delete(dir)
        }),
      )
      return ToolRegistryService.of({
        ids: () => Effect.promise(() => ToolRegistry.ids()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// AgentService
// ---------------------------------------------------------------------------

export namespace AgentService {
  export interface Service {
    readonly list: () => Effect.Effect<Agent.Info[]>
  }
}

export class AgentService extends ServiceMap.Service<AgentService, AgentService.Service>()("@opencode/Agent") {
  static readonly layer = Layer.effect(
    AgentService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { Agent, agentStates } = yield* Effect.promise(() => import("@/agent/agent"))
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          agentStates.delete(dir)
        }),
      )
      return AgentService.of({
        list: () => Effect.promise(() => Agent.list()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// CommandService
// ---------------------------------------------------------------------------

export namespace CommandService {
  export interface Service {
    readonly list: () => Effect.Effect<Command.Info[]>
  }
}

export class CommandService extends ServiceMap.Service<CommandService, CommandService.Service>()("@opencode/Command") {
  static readonly layer = Layer.effect(
    CommandService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { Command, commandStates } = yield* Effect.promise(() => import("@/command"))
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          commandStates.delete(dir)
        }),
      )
      return CommandService.of({
        list: () => Effect.promise(() => Command.list(dir)),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// ProviderService
// ---------------------------------------------------------------------------

export namespace ProviderService {
  export interface Service {
    readonly list: () => Effect.Effect<Record<string, Provider.Info>>
  }
}

export class ProviderService extends ServiceMap.Service<ProviderService, ProviderService.Service>()(
  "@opencode/Provider",
) {
  static readonly layer = Layer.effect(
    ProviderService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { Provider, providerStates } = yield* Effect.promise(() => import("@/provider/provider"))
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          providerStates.delete(dir)
        }),
      )
      return ProviderService.of({
        list: () => Effect.promise(() => Provider.list()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// PromptService
// ---------------------------------------------------------------------------

export namespace PromptService {
  export interface Service {
    readonly noop: () => Effect.Effect<void>
  }
}

export class PromptService extends ServiceMap.Service<PromptService, PromptService.Service>()("@opencode/Prompt") {
  static readonly layer = Layer.effect(
    PromptService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { promptStates } = yield* Effect.promise(() => import("@/session/prompt"))
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          const current = promptStates.get(dir)
          if (current) {
            for (const item of Object.values(current)) {
              item.abort.abort()
            }
            promptStates.delete(dir)
          }
        }),
      )
      return PromptService.of({
        noop: () => Effect.void,
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// PtyService
// ---------------------------------------------------------------------------

export namespace PtyService {
  export interface Service {
    readonly list: () => Effect.Effect<Pty.Info[]>
  }
}

export class PtyService extends ServiceMap.Service<PtyService, PtyService.Service>()("@opencode/Pty") {
  static readonly layer = Layer.effect(
    PtyService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { Pty, ptyStateMap } = yield* Effect.promise(() => import("@/pty"))
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          const sessions = ptyStateMap.get(dir)
          if (sessions) {
            for (const session of sessions.values()) {
              try {
                session.process.kill()
              } catch {}
              for (const [key, ws] of session.subscribers.entries()) {
                try {
                  if (ws.data === key) ws.close()
                } catch {
                  // ignore
                }
              }
            }
            sessions.clear()
          }
          ptyStateMap.delete(dir)
        }),
      )
      return PtyService.of({
        list: () => Effect.sync(() => Pty.list()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// LspService
// ---------------------------------------------------------------------------

export namespace LspService {
  export interface Service {
    readonly init: () => Effect.Effect<void>
  }
}

export class LspService extends ServiceMap.Service<LspService, LspService.Service>()("@opencode/Lsp") {
  static readonly layer = Layer.effect(
    LspService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { LSP, lspStateMap } = yield* Effect.promise(() => import("@/lsp"))
      yield* Effect.promise(() => LSP.init())
      yield* Effect.addFinalizer(() =>
        Effect.promise(async () => {
          const s = lspStateMap.get(dir)
          if (s) {
            const resolved = await s
            await Promise.all(resolved.clients.map((client) => client.shutdown()))
          }
          lspStateMap.delete(dir)
        }),
      )
      return LspService.of({
        init: () => Effect.promise(() => LSP.init()),
      })
    }),
  )
}

// ---------------------------------------------------------------------------
// McpService
// ---------------------------------------------------------------------------

export namespace McpService {
  export interface Service {
    readonly status: () => Effect.Effect<Record<string, MCP.Status>>
  }
}

export class McpService extends ServiceMap.Service<McpService, McpService.Service>()("@opencode/Mcp") {
  static readonly layer = Layer.effect(
    McpService,
    Effect.gen(function* () {
      const { directory: dir } = yield* InstanceContext
      const { MCP, mcpStateMap, descendants } = yield* Effect.promise(() => import("@/mcp"))
      yield* Effect.addFinalizer(() =>
        Effect.promise(async () => {
          const s = mcpStateMap.get(dir)
          if (s) {
            const state = await s
            for (const client of Object.values(state.clients)) {
              const pid = (client.transport as any)?.pid
              if (typeof pid !== "number") continue
              for (const dpid of await descendants(pid)) {
                try {
                  process.kill(dpid, "SIGTERM")
                } catch {}
              }
            }
            await Promise.all(
              Object.values(state.clients).map((client) =>
                client.close().catch((error) => {
                  console.error("Failed to close MCP client", error)
                }),
              ),
            )
          }
          mcpStateMap.delete(dir)
        }),
      )
      return McpService.of({
        status: () => Effect.promise(() => MCP.status()),
      })
    }),
  )
}
