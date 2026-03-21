import { EventEmitter } from "events"

// Event emitter boundary: payload varies per BusEvent.Definition.
// GlobalBus carries heterogeneous event types — subscribers narrow via Bus.subscribe().
// biome-ignore lint: event emitter with heterogeneous payload types
export const GlobalBus = new EventEmitter<{
  event: [
    {
      directory?: string
      payload: any
    },
  ]
}>()
