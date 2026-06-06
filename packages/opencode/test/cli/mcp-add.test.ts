import { describe, expect, test } from "bun:test"
import { resolveMcpAdd } from "../../src/cli/cmd/mcp"

describe("resolveMcpAdd", () => {
  test("builds remote server config with headers", () => {
    expect(
      resolveMcpAdd({
        name: "github",
        url: "https://example.com/mcp",
        header: ["Authorization=Bearer {env:GITHUB_TOKEN}", "X-Option=one=two"],
      }),
    ).toEqual({
      name: "github",
      config: {
        type: "remote",
        url: "https://example.com/mcp",
        headers: {
          Authorization: "Bearer {env:GITHUB_TOKEN}",
          "X-Option": "one=two",
        },
      },
    })
  })

  test("builds local server config with argv and environment", () => {
    expect(
      resolveMcpAdd({
        name: "local",
        env: ["API_KEY=secret", "VALUE=one=two"],
        "--": ["npx", "-y", "@example/server", "--label", "two words"],
      }),
    ).toEqual({
      name: "local",
      config: {
        type: "local",
        command: ["npx", "-y", "@example/server", "--label", "two words"],
        environment: {
          API_KEY: "secret",
          VALUE: "one=two",
        },
      },
    })
  })

  test("keeps interactive mode when no arguments are provided", () => {
    expect(resolveMcpAdd({})).toBeUndefined()
  })

  test("rejects invalid non-interactive combinations", () => {
    expect(() => resolveMcpAdd({ url: "https://example.com/mcp" })).toThrow(
      "A server name is required for non-interactive MCP configuration",
    )
    expect(() => resolveMcpAdd({ name: "both", url: "https://example.com/mcp", "--": ["server"] })).toThrow(
      "Provide either --url <url> or a command after --",
    )
    expect(() => resolveMcpAdd({ name: "bad", url: "not a url" })).toThrow("Invalid URL: not a url")
    expect(() => resolveMcpAdd({ name: "remote", url: "https://example.com/mcp", env: ["KEY=value"] })).toThrow(
      "--env is only valid for local MCP servers",
    )
    expect(() => resolveMcpAdd({ name: "local", "--": ["server"], header: ["Key=value"] })).toThrow(
      "--header is only valid for remote MCP servers",
    )
    expect(() => resolveMcpAdd({ name: "local", "--": ["server"], env: ["=value"] })).toThrow(
      "Invalid environment variable: =value. Expected KEY=VALUE",
    )
  })
})
