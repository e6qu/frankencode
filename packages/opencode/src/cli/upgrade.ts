import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Flag } from "@/flag/flag"
import { Installation } from "@/installation"
import { InstanceALS } from "@/project/instance-als"

export async function upgrade() {
  const config = await Config.global()
  const method = await Installation.method()
  const latest = await Installation.latest(method).catch(() => {})
  if (!latest) return
  if (Installation.VERSION === latest) return

  if (config.autoupdate === false || Flag.OPENCODE_DISABLE_AUTOUPDATE) {
    return
  }
  if (config.autoupdate === "notify") {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest }, InstanceALS.directory)
    return
  }

  if (method === "unknown") return
  await Installation.upgrade(method, latest)
    .then(() => Bus.publish(Installation.Event.Updated, { version: latest }, InstanceALS.directory))
    .catch(() => {})
}
