import { expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { LSPServer } from "../../src/lsp/server"

const root = path.join(import.meta.dir, "../..")
const args = LSPServer.Typescript.args
if (!args) throw new Error("typescript LSP args helper was not available")

test("typescript lsp uses native tsserver path", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "tsconfig.json"), "{}")
    },
  })

  const cfg = await args(tmp.path, root)
  expect(cfg).toBeDefined()
  if (!cfg) throw new Error("typescript LSP args were not available")

  expect(cfg.args).toContain("--tsserver-path")
  expect(cfg.args[cfg.args.indexOf("--tsserver-path") + 1]).toContain("typescript/lib/tsserver.js")
  expect(cfg.args).not.toContain("--ignore-node-modules")
})

test("typescript lsp ignores node_modules without project config", async () => {
  await using tmp = await tmpdir()

  const cfg = await args(tmp.path, root)
  expect(cfg).toBeDefined()
  if (!cfg) throw new Error("typescript LSP args were not available")

  expect(cfg.args).toContain("--ignore-node-modules")
})
