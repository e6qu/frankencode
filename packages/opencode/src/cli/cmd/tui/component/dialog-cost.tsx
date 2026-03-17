import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { useSDK } from "@tui/context/sdk"
import { createMemo, createResource } from "solid-js"
import { computeSessionMetrics, computeStatsMetrics, formatCost, formatRow } from "./cost-metrics"

export function DialogCost(props: { sessionID: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()
  const sdk = useSDK()

  const sessionMetrics = createMemo(() => {
    const msgs = sync.data.message[props.sessionID] ?? []
    return computeSessionMetrics(msgs, sync.data.provider)
  })

  const [dailyStats] = createResource(async () => {
    const res = await sdk.fetch(sdk.url + "/session/stats?days=1", {})
    return res.json()
  })

  const [monthlyStats] = createResource(async () => {
    const res = await sdk.fetch(sdk.url + "/session/stats?days=30", {})
    return res.json()
  })

  const dailyMetrics = createMemo(() => {
    const data = dailyStats()
    if (!data) return { actual: 0, noCache: 0, cacheHitPct: 0 }
    return computeStatsMetrics(data, sync.data.provider)
  })

  const monthlyMetrics = createMemo(() => {
    const data = monthlyStats()
    if (!data) return { actual: 0, noCache: 0, cacheHitPct: 0 }
    return computeStatsMetrics(data, sync.data.provider)
  })

  const rows = createMemo(() => {
    const sess = sessionMetrics()
    const daily = dailyMetrics()
    const monthly = monthlyMetrics()

    const allMetrics = [sess, daily, monthly]
    const maxCostWidth = Math.max(
      ...allMetrics.map((m) => `${formatCost(m.actual)}╱${formatCost(m.noCache)}`.length),
    )

    return [
      formatRow("Sess", sess, maxCostWidth),
      formatRow("☼-ly", daily, maxCostWidth),
      formatRow("☽-ly", monthly, maxCostWidth),
    ]
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={0} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Usage
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <text fg={theme.text}>{rows()[0]}</text>
      <text fg={theme.text}>{rows()[1]}</text>
      <text fg={theme.text}>{rows()[2]}</text>
    </box>
  )
}
