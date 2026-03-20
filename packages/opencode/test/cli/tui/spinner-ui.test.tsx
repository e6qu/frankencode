import { describe, expect, test, mock } from "bun:test"
import { mockTheme, mockKV } from "./helpers"

mockTheme()

// Mock KV with animations disabled so we get the static fallback
mock.module("@tui/context/kv", () => ({
  useKV: () => ({
    get: (key: string, fallback?: any) => {
      if (key === "animations_enabled") return false
      return fallback
    },
    set: () => {},
    ready: true,
    store: {},
  }),
}))

// Mock the spinner custom element registration
mock.module("opentui-spinner/solid", () => ({}))

const { testRender } = await import("@opentui/solid")
const { Spinner } = await import("../../../src/cli/cmd/tui/component/spinner")

describe("Spinner UI", () => {
  test("renders fallback dots when animations disabled", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Spinner />, {
      width: 30,
      height: 5,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // When animations_enabled is false, it shows the fallback "⋯"
    expect(frame).toContain("⋯")
  })

  test("renders child text alongside spinner", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Spinner>Loading data</Spinner>, {
      width: 30,
      height: 5,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Loading data")
  })

  test("renders fallback with child text", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Spinner>Please wait</Spinner>, {
      width: 30,
      height: 5,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("⋯")
    expect(frame).toContain("Please wait")
  })
})
