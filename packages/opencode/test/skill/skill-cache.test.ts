import { test, expect } from "bun:test"
import { Skill } from "../../src/skill"
import { Instance } from "../fixture/instance-shim"
import { tmpdir } from "../fixture/fixture"
import path from "path"

test("Skill.get() caches content on repeated calls (#33)", async () => {
  await using tmp = await tmpdir({
    git: true,
    init: async (dir) => {
      const skillDir = path.join(dir, ".opencode", "skill", "cache-skill")
      await Bun.write(
        path.join(skillDir, "SKILL.md"),
        `---
name: cache-skill
description: Skill for cache testing.
---

# Cache Skill

This content should be cached.
`,
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // First call should parse the file
      const first = await Skill.get("cache-skill")
      expect(first).toBeDefined()
      expect(first!.content).toContain("This content should be cached")

      // Second call should return cached content (same result)
      const second = await Skill.get("cache-skill")
      expect(second).toBeDefined()
      expect(second!.content).toBe(first!.content)
    },
  })
})

test("Skill content cache is cleared on state reload", async () => {
  await using tmp = await tmpdir({
    git: true,
    init: async (dir) => {
      const skillDir = path.join(dir, ".opencode", "skill", "reload-skill")
      await Bun.write(
        path.join(skillDir, "SKILL.md"),
        `---
name: reload-skill
description: Skill for reload testing.
---

# Reload Skill

Original content.
`,
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const first = await Skill.get("reload-skill")
      expect(first).toBeDefined()
      expect(first!.content).toContain("Original content")

      // After reload, cache should be cleared and content re-read
      Instance.reload({ directory: tmp.path })
      const second = await Skill.get("reload-skill")
      expect(second).toBeDefined()
      expect(second!.content).toContain("Original content")
    },
  })
})
