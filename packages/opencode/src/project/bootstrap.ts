import { Plugin } from "../plugin"
import { Format } from "../format"
import { LSP } from "../lsp"
import { FileWatcherService } from "../file/watcher"
import { File } from "../file"
import { Project } from "./project"
import { Bus } from "../bus"
import { Command } from "../command"
import { InstanceALS } from "./instance-als"
import { VcsService } from "./vcs"
import { Log } from "@/util/log"
import { ShareNext } from "@/share/share-next"
import { Snapshot } from "../snapshot"
import { Truncate } from "../tool/truncation"
import { runPromiseInstance } from "@/effect/runtime"

const HOUR_MS = 60 * 60 * 1000
let truncateTimer: ReturnType<typeof setInterval> | undefined

function ensureTruncateCleanup() {
  if (truncateTimer) return
  Truncate.cleanup().catch(() => {})
  truncateTimer = setInterval(() => {
    Truncate.cleanup().catch(() => {})
  }, HOUR_MS)
  truncateTimer.unref()
}

export async function InstanceBootstrap() {
  const directory = InstanceALS.directory
  const projectID = InstanceALS.project.id
  Log.Default.info("bootstrapping", { directory })
  await Plugin.init()
  ShareNext.init()
  await Format.init()
  await LSP.init()
  await runPromiseInstance(
    FileWatcherService.use((service) => service.init()),
    directory,
  )
  File.init()
  await runPromiseInstance(
    VcsService.use((s) => s.init()),
    directory,
  )
  Snapshot.init()
  ensureTruncateCleanup()

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(projectID)
    }
  })
}
