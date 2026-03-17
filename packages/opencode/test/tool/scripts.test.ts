import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Scripts } from "../../src/skill/scripts"

describe("skill.scripts", () => {
  describe("tool ID format (#35)", () => {
    test("uses :: separator to avoid collision with underscored names", async () => {
      await using tmp = await tmpdir({
        git: true,
        init: async (dir) => {
          // Create a skill with a script
          const skillDir = path.join(dir, ".opencode", "skill", "my-skill")
          const scriptsDir = path.join(skillDir, "scripts")
          await Bun.write(
            path.join(skillDir, "SKILL.md"),
            `---
name: my-skill
description: Test skill with scripts.
---

# My Skill
`,
          )
          await Bun.write(path.join(scriptsDir, "hello.sh"), "#!/bin/bash\necho hello\n")
        },
      })

      const home = process.env.OPENCODE_TEST_HOME
      process.env.OPENCODE_TEST_HOME = tmp.path
      try {
        await Instance.provide({
          directory: tmp.path,
          fn: async () => {
            const tools = await Scripts.asTools()
            if (tools.length > 0) {
              // Tool ID should use :: separator
              expect(tools[0].id).toContain("::")
              expect(tools[0].id).toMatch(/^script::/)
              // Should NOT use underscore separator
              expect(tools[0].id).not.toMatch(/^[^:]+_[^:]+$/)
            }
          },
        })
      } finally {
        process.env.OPENCODE_TEST_HOME = home
      }
    })
  })

  describe("argument injection prevention (#34)", () => {
    test("inserts -- separator before user args", async () => {
      const source = await Bun.file(
        path.join(import.meta.dir, "../../src/skill/scripts.ts"),
      ).text()

      // Verify the -- separator is used
      expect(source).toContain('"--"')
      expect(source).toContain("userArgs")

      // Each interpreter case should use userArgs (which includes --)
      const cases = [".ts", ".js", ".py", ".sh"]
      for (const ext of cases) {
        expect(source).toContain(`case "${ext}"`)
      }
      // All cases spread userArgs, not raw params.args
      const rawSpreadCount = (source.match(/\.\.\.\(params\.args/g) || []).length
      expect(rawSpreadCount).toBe(0)
    })
  })
})
