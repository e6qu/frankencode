import z from "zod"
import type { MessageV2 } from "../session/message-v2"
import type { Agent } from "../agent/agent"
import type { PermissionNext } from "../permission/next"
import type { SessionID, MessageID } from "../session/schema"
import type { ProjectID } from "../project/schema"
import { Truncate } from "./truncation"

export namespace Tool {
  // Metadata flows from typed tool execute() results into the DB (as JSON) and back out
  // to TUI components. Since the DB round-trip produces Record<string, unknown>, the
  // metadata interface must accept unknown to remain compatible with deserialized values.
  interface Metadata {
    [key: string]: unknown
  }

  export interface InitContext {
    agent?: Agent.Info
    directory?: string
    worktree?: string
  }

  export type Context<M extends Metadata = Metadata> = {
    sessionID: SessionID
    messageID: MessageID
    agent: string
    abort: AbortSignal
    callID?: string
    extra?: { [key: string]: unknown }
    messages: MessageV2.WithParts[]
    /** Resolved project directory (absolute path) */
    directory: string
    /** Git worktree or sandbox directory */
    worktree: string
    /** Project ID */
    projectID: ProjectID
    /** Check if a path is within the project boundary */
    containsPath(filepath: string): boolean
    metadata(input: { title?: string; metadata?: M }): void
    ask(input: Omit<PermissionNext.Request, "id" | "sessionID" | "tool">): Promise<void>
  }
  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    id: string
    init: (ctx?: InitContext) => Promise<{
      description: string
      parameters: Parameters
      execute(
        args: z.infer<Parameters>,
        ctx: Context,
      ): Promise<{
        title: string
        metadata: M
        output: string
        attachments?: Omit<MessageV2.FilePart, "id" | "sessionID" | "messageID">[]
      }>
      formatValidationError?(error: z.ZodError): string
    }>
  }

  export type InferParameters<T extends Info> = T extends Info<infer P> ? z.infer<P> : never
  export type InferMetadata<T extends Info> = T extends Info<z.ZodType, infer M> ? M : never

  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    id: string,
    init: Info<Parameters, Result>["init"] | Awaited<ReturnType<Info<Parameters, Result>["init"]>>,
  ): Info<Parameters, Result> {
    return {
      id,
      init: async (initCtx) => {
        const toolInfo = init instanceof Function ? await init(initCtx) : { ...init }
        const execute = toolInfo.execute
        toolInfo.execute = async (args, ctx) => {
          try {
            toolInfo.parameters.parse(args)
          } catch (error) {
            if (error instanceof z.ZodError && toolInfo.formatValidationError) {
              throw new Error(toolInfo.formatValidationError(error), { cause: error })
            }
            throw new Error(
              `The ${id} tool was called with invalid arguments: ${error}.\nPlease rewrite the input so it satisfies the expected schema.`,
              { cause: error },
            )
          }
          const result = await execute(args, ctx)
          // skip truncation for tools that handle it themselves
          if (result.metadata.truncated !== undefined) {
            return result
          }
          const truncated = await Truncate.output(result.output, {}, initCtx?.agent)
          return {
            ...result,
            output: truncated.content,
            metadata: {
              ...result.metadata,
              truncated: truncated.truncated,
              ...(truncated.truncated && { outputPath: truncated.outputPath }),
            },
          }
        }
        return toolInfo
      },
    }
  }
}
