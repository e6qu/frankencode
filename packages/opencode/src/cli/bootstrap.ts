import { InstanceBootstrap } from "../project/bootstrap"
import { InstanceLifecycle } from "../project/lifecycle"
import { InstanceALS } from "../project/instance-als"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  const ctx = await InstanceLifecycle.boot(directory, InstanceBootstrap)
  return InstanceALS.run(ctx, async () => {
    try {
      const result = await cb()
      return result
    } finally {
      await InstanceLifecycle.dispose(InstanceALS.directory)
    }
  })
}
