import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { InstanceContext } from "@/effect/instance-context"
import { SessionID } from "./schema"
import z from "zod"
import { Effect, Layer, ServiceMap } from "effect"

const states = new Map<string, Record<string, SessionStatus.Info>>()

function state(directory?: string) {
  const dir = directory ?? Instance.directory
  let s = states.get(dir)
  if (!s) {
    s = {}
    states.set(dir, s)
  }
  return s
}

export namespace SessionStatus {
  export const Info = z
    .union([
      z.object({
        type: z.literal("idle"),
      }),
      z.object({
        type: z.literal("retry"),
        attempt: z.number(),
        message: z.string(),
        next: z.number(),
      }),
      z.object({
        type: z.literal("busy"),
      }),
    ])
    .meta({
      ref: "SessionStatus",
    })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Status: BusEvent.define(
      "session.status",
      z.object({
        sessionID: SessionID.zod,
        status: Info,
      }),
    ),
    // deprecated
    Idle: BusEvent.define(
      "session.idle",
      z.object({
        sessionID: SessionID.zod,
      }),
    ),
  }

  export function get(sessionID: SessionID) {
    return (
      state()[sessionID] ?? {
        type: "idle",
      }
    )
  }

  export function list() {
    return state()
  }

  export function set(sessionID: SessionID, status: Info) {
    Bus.publish(Event.Status, {
      sessionID,
      status,
    })
    if (status.type === "idle") {
      // deprecated
      Bus.publish(Event.Idle, {
        sessionID,
      })
      delete state()[sessionID]
      return
    }
    state()[sessionID] = status
  }
}

export namespace SessionStatusService {
  export interface Service {
    readonly get: (sessionID: SessionID) => SessionStatus.Info
    readonly list: () => Record<string, SessionStatus.Info>
    readonly set: (sessionID: SessionID, status: SessionStatus.Info) => void
  }
}

export class SessionStatusService extends ServiceMap.Service<SessionStatusService, SessionStatusService.Service>()(
  "@opencode/SessionStatus",
) {
  static readonly layer = Layer.effect(
    SessionStatusService,
    Effect.gen(function* () {
      const ctx = yield* InstanceContext
      const dir = ctx.directory
      let data = states.get(dir)
      if (!data) {
        data = {}
        states.set(dir, data)
      }
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          states.delete(dir)
        }),
      )
      return SessionStatusService.of({
        get: (sessionID) =>
          data[sessionID] ?? {
            type: "idle",
          },
        list: () => data,
        set: (sessionID, status) => {
          Bus.publish(SessionStatus.Event.Status, { sessionID, status })
          if (status.type === "idle") {
            Bus.publish(SessionStatus.Event.Idle, { sessionID })
            delete data[sessionID]
            return
          }
          data[sessionID] = status
        },
      })
    }),
  )
}
