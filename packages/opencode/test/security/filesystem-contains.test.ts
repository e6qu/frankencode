import { describe, expect, test } from "bun:test"
import { Filesystem } from "../../src/util/filesystem"
import { tmpdir } from "../fixture/fixture"
import { symlinkSync, mkdirSync, writeFileSync } from "fs"
import path from "path"

describe("security.filesystem.contains", () => {
  test("returns true for child inside parent", () => {
    expect(Filesystem.contains("/project", "/project/src/file.ts")).toBe(true)
  })

  test("returns false for path outside parent", () => {
    expect(Filesystem.contains("/project", "/etc/passwd")).toBe(false)
  })

  test("returns false for parent traversal via ..", () => {
    expect(Filesystem.contains("/project", "/project/../etc/passwd")).toBe(false)
  })

  test("S1: symlink pointing outside project is blocked", async () => {
    await using tmp = await tmpdir()
    const target = path.join(tmp.path, "outside")
    mkdirSync(target)
    writeFileSync(path.join(target, "secret.txt"), "secret data")

    const project = path.join(tmp.path, "project")
    mkdirSync(project)

    // Create symlink inside project pointing to outside directory
    symlinkSync(target, path.join(project, "escape"))

    // The symlink resolves to outside the project — should return false
    expect(Filesystem.contains(project, path.join(project, "escape", "secret.txt"))).toBe(false)
  })

  test("non-existent file falls back to lexical check", () => {
    // File doesn't exist but path is lexically inside parent
    expect(Filesystem.contains("/project", "/project/newfile.ts")).toBe(true)
  })

  test("non-existent file outside parent rejected", () => {
    expect(Filesystem.contains("/project", "/other/file.ts")).toBe(false)
  })
})
