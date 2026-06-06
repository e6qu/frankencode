import { expect, test } from "bun:test"
import path from "path"
import { pathToFileURL } from "url"
import { tmpdir } from "../fixture/fixture"

const repo = path.join(import.meta.dir, "../../../..")
const root = path.join(import.meta.dir, "../..")
const sdk = path.join(repo, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm")
const mod = (file: string) => pathToFileURL(path.join(sdk, file)).href
const src = (file: string) => pathToFileURL(path.join(root, file)).href

test("MCP tools tolerate invalid outputSchema references", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "server.mjs"),
        `
import { Server } from "${mod("server/index.js")}"
import { StdioServerTransport } from "${mod("server/stdio.js")}"
import { CallToolRequestSchema, ListToolsRequestSchema } from "${mod("types.js")}"

const server = new Server(
  { name: "tolerant", version: "1.0.0" },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search",
      description: "Search",
      inputSchema: {
        type: "object",
        properties: {},
      },
      outputSchema: {
        $ref: "#/$defs/result",
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async () => ({
  content: [{ type: "text", text: "ok" }],
}))

await server.connect(new StdioServerTransport())
`,
      )
      await Bun.write(
        path.join(dir, "runner.ts"),
        `
import path from "path"
import { Instance } from "${src("test/fixture/instance-shim.ts")}"
import { MCP } from "${src("src/mcp/index.ts")}"

const dir = process.env.OPENCODE_MCP_TEST_DIR
if (!dir) throw new Error("test directory was not provided")

const bun = Bun.which("bun")
if (!bun) throw new Error("bun executable was not available")

await Instance.provide({
  directory: dir,
  fn: async () => {
    const result = await MCP.add("tolerant", {
      type: "local",
      command: [bun, path.join(dir, "server.mjs")],
    })

    if (result.status.tolerant?.status !== "connected") {
      throw new Error("MCP server did not connect")
    }

    const tools = await MCP.tools()
    if (!tools.tolerant_search) {
      throw new Error("tolerant_search tool was not registered")
    }

    await MCP.disconnect("tolerant")
  },
})
`,
      )
    },
  })

  const bun = Bun.which("bun")
  if (!bun) throw new Error("bun executable was not available")

  const proc = Bun.spawn(
    [bun, "test", "--preload", path.join(root, "test/preload.ts"), path.join(tmp.path, "runner.ts")],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENCODE_MCP_TEST_DIR: tmp.path,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  if (code !== 0) throw new Error(`MCP lifecycle runner failed\nstdout:\n${stdout}\nstderr:\n${stderr}`)
  expect(code).toBe(0)
})
