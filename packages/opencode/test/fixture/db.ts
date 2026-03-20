import { rm } from "fs/promises"
import { InstanceLifecycle } from "../../src/project/lifecycle"
import { Database } from "../../src/storage/db"

export async function resetDatabase() {
  await InstanceLifecycle.disposeAll().catch(() => undefined)
  Database.close()
  await rm(Database.Path, { force: true }).catch(() => undefined)
  await rm(`${Database.Path}-wal`, { force: true }).catch(() => undefined)
  await rm(`${Database.Path}-shm`, { force: true }).catch(() => undefined)
}
