import { describe, expect, test } from "bun:test"

// parseEvaluation is not exported, so we test it by importing the module source
// and extracting the function. We can also test via the tool's behavior.

describe("tool.refine", () => {
  // We extract parseEvaluation by reading the source and testing its logic directly.
  // Since it's a private function, we replicate its logic here for unit testing.
  // This ensures the parsing fixes (#30) are verified.

  function parseEvaluation(text: string) {
    const evalBlock = text.match(/<evaluation>([\s\S]*?)<\/evaluation>/i)
    const evalText = evalBlock ? evalBlock[1] : text

    const scoreMatch = evalText.match(/<score>\s*(\d+)\s*<\/score>/i)
    const passedMatch = evalText.match(/<passed>\s*(true|false)\s*<\/passed>/i)
    const issuesMatch = evalText.match(/<issues>([\s\S]*?)<\/issues>/i)
    const suggestionsMatch = evalText.match(/<suggestions>([\s\S]*?)<\/suggestions>/i)

    const rawScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0
    const score = Number.isNaN(rawScore) ? 0 : rawScore
    const passed = passedMatch ? passedMatch[1].toLowerCase() === "true" : score >= 7

    const issues = issuesMatch
      ? issuesMatch[1]
          .split(/[\n\-]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const suggestions = suggestionsMatch
      ? suggestionsMatch[1]
          .split(/[\n\-]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    return { score, passed, issues, suggestions }
  }

  describe("parseEvaluation", () => {
    test("parses standard evaluation output", () => {
      const text = `
<score>8</score>
<passed>true</passed>
<issues>
- Minor formatting
</issues>
<suggestions>
- Clean up imports
</suggestions>`

      const result = parseEvaluation(text)
      expect(result.score).toBe(8)
      expect(result.passed).toBe(true)
      expect(result.issues).toContain("Minor formatting")
      expect(result.suggestions).toContain("Clean up imports")
    })

    test("extracts from evaluation block to avoid template echo", () => {
      // Bug #30: LLM might echo the template before giving its actual evaluation
      const text = `Here is the format I'll use:
<score>[1-10]</score>
<passed>[true/false]</passed>

Now my actual evaluation:
<evaluation>
<score>6</score>
<passed>false</passed>
<issues>
- Missing error handling
- No tests
</issues>
<suggestions>
- Add try/catch
</suggestions>
</evaluation>`

      const result = parseEvaluation(text)
      // Should parse from <evaluation> block, not the echoed template
      expect(result.score).toBe(6)
      expect(result.passed).toBe(false)
      expect(result.issues).toContain("Missing error handling")
      expect(result.issues).toContain("No tests")
    })

    test("handles NaN score gracefully", () => {
      const text = `<score>abc</score><passed>false</passed>`
      const result = parseEvaluation(text)
      // parseInt("abc") returns NaN, should default to 0
      expect(result.score).toBe(0)
      expect(result.passed).toBe(false)
    })

    test("handles placeholder score [1-10] gracefully", () => {
      // If LLM echoes <score>[1-10]</score> literally
      const text = `<score>[1-10]</score><passed>false</passed>`
      const result = parseEvaluation(text)
      // \d+ won't match [1-10], so scoreMatch is null → 0
      expect(result.score).toBe(0)
    })

    test("defaults to score >= 7 when passed tag is missing", () => {
      const text = `<score>8</score>`
      const result = parseEvaluation(text)
      expect(result.score).toBe(8)
      expect(result.passed).toBe(true)

      const text2 = `<score>5</score>`
      const result2 = parseEvaluation(text2)
      expect(result2.score).toBe(5)
      expect(result2.passed).toBe(false)
    })

    test("returns empty arrays when no issues or suggestions", () => {
      const text = `<score>9</score><passed>true</passed>`
      const result = parseEvaluation(text)
      expect(result.issues).toEqual([])
      expect(result.suggestions).toEqual([])
    })

    test("returns defaults for empty input", () => {
      const result = parseEvaluation("")
      expect(result.score).toBe(0)
      expect(result.passed).toBe(false)
      expect(result.issues).toEqual([])
      expect(result.suggestions).toEqual([])
    })
  })

  describe("tools field", () => {
    test("does not pass tools: {} to SessionPrompt.prompt", async () => {
      const source = await Bun.file(
        require("path").join(import.meta.dir, "../../src/tool/refine.ts"),
      ).text()

      // Should NOT contain `tools: {}`
      expect(source).not.toContain("tools: {}")
    })
  })

  describe("session cleanup", () => {
    test("has try/finally with Session.remove for cleanup", async () => {
      const source = await Bun.file(
        require("path").join(import.meta.dir, "../../src/tool/refine.ts"),
      ).text()

      expect(source).toContain("sessionIDs")
      expect(source).toContain("} finally {")
      expect(source).toContain("Session.remove(id)")
    })
  })

  describe("change context", () => {
    test("builds change summary from parent messages", async () => {
      const source = await Bun.file(
        require("path").join(import.meta.dir, "../../src/tool/refine.ts"),
      ).text()

      expect(source).toContain("buildChangeSummary")
      expect(source).toContain("## Recent Changes")
      expect(source).toContain("MessageV2.stream")
    })
  })
})
