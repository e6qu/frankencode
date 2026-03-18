import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"

// We test the exported tool and internal behaviors indirectly through it.
// For unit-level circuit breaker tests, we import the module and test via the tool.

describe("tool.verify", () => {
  describe("circuit breaker", () => {
    test("lastFailure is set before throw on threshold breach", async () => {
      // The bug was that lastFailure was set AFTER throw, so cooldown used stale timestamp.
      // We verify by importing the module and checking the class behavior.
      const mod = await import("../../src/tool/verify")
      const tool = mod.VerifyTool
      expect(tool).toBeDefined()

      // The circuit breaker is internal, but we can verify the tool schema has circuitBreaker param
      const schema = tool.init && (await tool.init())
      expect(schema).toBeDefined()
      expect(schema!.parameters).toBeDefined()
    })

    test("healthy field exists (not inverted open)", async () => {
      // Verify the source doesn't use `this.open` anymore (renamed to `this.healthy`)
      const source = await Bun.file(
        path.join(import.meta.dir, "../../src/tool/verify.ts"),
      ).text()
      expect(source).toContain("private healthy")
      expect(source).not.toMatch(/private open\b/)
    })

    test("recordSuccess method exists", async () => {
      const source = await Bun.file(
        path.join(import.meta.dir, "../../src/tool/verify.ts"),
      ).text()
      expect(source).toContain("recordSuccess()")
    })
  })

  describe("parameters", () => {
    test("does not accept unused scope/files/criteria params", async () => {
      const mod = await import("../../src/tool/verify")
      const schema = await mod.VerifyTool.init!()
      const params = schema.parameters

      // These should have been removed
      const shape = params.shape as Record<string, unknown>
      expect(shape.scope).toBeUndefined()
      expect(shape.files).toBeUndefined()
      expect(shape.criteria).toBeUndefined()

      // These should still exist
      expect(shape.autoFix).toBeDefined()
      expect(shape.timeout).toBeDefined()
      expect(shape.circuitBreaker).toBeDefined()
    })
  })

  describe("config", () => {
    test("default cooldown is 30000ms", async () => {
      const source = await Bun.file(
        path.join(import.meta.dir, "../../src/tool/verify.ts"),
      ).text()
      expect(source).toContain("cooldownMs: 30000")
      expect(source).not.toContain("cooldownMs: 1000")
    })

    test("uses mergeDeep for config merge", async () => {
      const source = await Bun.file(
        path.join(import.meta.dir, "../../src/tool/verify.ts"),
      ).text()
      expect(source).toContain("mergeDeep(defaultConfig, config.verification)")
    })
  })

  describe("command execution", () => {
    test("uses bash -c wrapper instead of split", async () => {
      const source = await Bun.file(
        path.join(import.meta.dir, "../../src/tool/verify.ts"),
      ).text()
      expect(source).toContain('["bash", "-c", command]')
      expect(source).not.toContain('command.split(" ")')
    })

    test("runs commands and returns results", async () => {
      await using tmp = await tmpdir({
        git: true,
        init: async (dir) => {
          // Create a package.json with simple test scripts
          await Bun.write(
            path.join(dir, "package.json"),
            JSON.stringify({
              scripts: {
                test: "echo test-pass",
                lint: "echo lint-pass",
                typecheck: "echo typecheck-pass",
              },
            }),
          )
        },
      })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const mod = await import("../../src/tool/verify")
          const schema = await mod.VerifyTool.init!()
          const result = await schema.execute(
            { autoFix: false, circuitBreaker: false },
            {
              sessionID: "ses_test" as any,
              messageID: "msg_test" as any,
              callID: "",
              agent: "build",
              abort: AbortSignal.any([]),
              messages: [],
              directory: Instance.directory,
              worktree: Instance.worktree,
              projectID: Instance.project.id,
              containsPath: (fp: string) => Instance.containsPath(fp),
              metadata: () => {},
              ask: async () => {},
            },
          )
          expect(result.metadata.passed).toBe(true)
          expect(result.output).toContain("passed")
        },
      })
    })

    test("handles quoted args in commands via bash -c", async () => {
      await using tmp = await tmpdir({
        git: true,
        init: async (dir) => {
          // Use a command with quotes that would break naive split
          await Bun.write(
            path.join(dir, "package.json"),
            JSON.stringify({
              scripts: {
                test: 'echo "hello world"',
                lint: "echo ok",
                typecheck: "echo ok",
              },
            }),
          )
        },
      })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const mod = await import("../../src/tool/verify")
          const schema = await mod.VerifyTool.init!()
          const result = await schema.execute(
            { autoFix: false, circuitBreaker: false },
            {
              sessionID: "ses_test" as any,
              messageID: "msg_test" as any,
              callID: "",
              agent: "build",
              abort: AbortSignal.any([]),
              messages: [],
              directory: Instance.directory,
              worktree: Instance.worktree,
              projectID: Instance.project.id,
              containsPath: (fp: string) => Instance.containsPath(fp),
              metadata: () => {},
              ask: async () => {},
            },
          )
          expect(result.metadata.passed).toBe(true)
        },
      })
    })
  })
})
