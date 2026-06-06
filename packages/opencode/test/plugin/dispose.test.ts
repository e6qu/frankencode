import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../fixture/instance-shim"
import { Plugin } from "../../src/plugin"

describe("plugin dispose hook", () => {
  test("runs when the instance is disposed", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const root = path.join(dir, ".opencode", "plugin")
        const marker = path.join(dir, "disposed.txt")
        await fs.mkdir(root, { recursive: true })
        await Bun.write(
          path.join(root, "dispose.ts"),
          [
            "export default async () => ({",
            "  dispose: async () => {",
            `    await Bun.write(${JSON.stringify(marker)}, "disposed")`,
            "  },",
            "})",
            "",
          ].join("\n"),
        )
        return marker
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await Plugin.init(Instance.directory)
        expect(await Bun.file(tmp.extra).exists()).toBe(false)
        await Instance.dispose()
        expect(await Bun.file(tmp.extra).text()).toBe("disposed")
      },
    })
  })
})
