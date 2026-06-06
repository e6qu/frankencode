import type { PermissionNext } from "@/permission/next"
import type { Agent } from "./agent"

export function derive(input: {
  parent: PermissionNext.Ruleset
  caller?: Agent.Info
  child: Agent.Info
}): PermissionNext.Ruleset {
  const task = input.child.permission.some((rule) => rule.permission === "task")
  const todo = input.child.permission.some((rule) => rule.permission === "todowrite")
  const deny = input.caller?.permission.filter((rule) => rule.action === "deny") ?? []
  return [
    ...deny,
    ...input.parent.filter((rule) => rule.permission === "external_directory" || rule.action === "deny"),
    ...(todo ? [] : [{ permission: "todowrite" as const, pattern: "*" as const, action: "deny" as const }]),
    ...(task ? [] : [{ permission: "task" as const, pattern: "*" as const, action: "deny" as const }]),
  ]
}
