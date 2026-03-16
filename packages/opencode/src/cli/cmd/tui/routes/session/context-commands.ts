import type { CommandOption } from "@tui/component/dialog-command"

export interface Toast {
  show(opts: { message: string; variant: "success" | "error" | "warning" | "info"; duration?: number }): void
}

export function contextCommands(toast: Toast): CommandOption[] {
  return [
    {
      title: "Show edit history",
      value: "context.history",
      category: "Context",
      slash: {
        name: "history",
        aliases: ["edit-history"],
      },
      onSelect: (dialog) => {
        toast.show({ message: "Run: opencode context history", variant: "info", duration: 5000 })
        dialog.clear()
      },
    },
    {
      title: "Show edit tree",
      value: "context.tree",
      category: "Context",
      slash: {
        name: "tree",
        aliases: ["edit-tree"],
      },
      onSelect: (dialog) => {
        toast.show({ message: "Run: opencode context tree", variant: "info", duration: 5000 })
        dialog.clear()
      },
    },
    {
      title: "List side threads",
      value: "context.threads",
      category: "Context",
      slash: {
        name: "threads",
        aliases: ["side-threads"],
      },
      onSelect: (dialog) => {
        toast.show({ message: "Run: opencode context threads", variant: "info", duration: 5000 })
        dialog.clear()
      },
    },
  ]
}
