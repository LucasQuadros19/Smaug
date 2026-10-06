import { useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "../ui/Card"
import { SegmentedControl } from "../ui/SegmentedControl"
import { useTheme } from "../../context/ThemeContext"
import { formatCurrency } from "../../lib/format"
import {
  AXIS_COLOR,
  GRID_COLOR,
  formatPeriodFull,
  formatPeriodLabel,
  seriesColor,
} from "../../lib/chartTheme"
import type { Granularity, NetWorthSeries } from "../../types"

type ViewKind = "total" | "breakdown"

function CustomTooltip({ active, payload, label, granularity }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">
        {formatPeriodFull(label, granularity)}
      </p>
      {payload.map((entry: any) => (
        <p
          key={entry.dataKey}
          className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function NetWorthChart({
  data,
  granularity,
}: {
  data: NetWorthSeries
  granularity: Granularity
}) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [view, setView] = useState<ViewKind>("total")

  const hasAssets = data.assets.length > 0

  const chartData = data.series.map((point) => {
    const row: Record<string, number | string> = {
      period: point.period,
      net_worth: point.net_worth,
      cash: point.cash,
    }
    for (const asset of data.assets) {
      row[`asset_${asset.id}`] = point.assets[String(asset.id)] ?? 0
    }
    return row
  })

  // Total é a linha principal; caixa e ativos entram como composição.
  const lines =
    view === "total"
      ? [{ key: "net_worth", name: "Patrimônio total", color: seriesColor(0, isDark), width: 2.5 }]
      : [
          { key: "cash", name: "Em contas", color: seriesColor(0, isDark), width: 2 },
          ...data.assets.slice(0, 5).map((asset, i) => ({
            key: `asset_${asset.id}`,
            name: asset.name,
            color: seriesColor(i + 1, isDark),
            width: 2,
          })),
        ]

  const isEmpty = data.series.every((p) => p.net_worth === 0)

  // Quanto o patrimônio andou entre a primeira e a última medição da série.
  const growth = (() => {
    const first = data.series[0]?.net_worth
    const last = data.series.at(-1)?.net_worth
    if (first === undefined || last === undefined || data.series.length < 2) return null
    const amount = last - first
    return { amount, percent: first !== 0 ? (amount / Math.abs(first)) * 100 : null }
  })()

  // Com vários registros no mesmo mês o eixo repetiria o mesmo rótulo várias
  // vezes. Marca só o primeiro ponto de cada rótulo, mantendo o último.
  const ticks = (() => {
    const seen = new Set<string>()
    const picked: string[] = []
    for (const row of chartData) {
      const label = formatPeriodLabel(String(row.period), granularity)
      if (!seen.has(label)) {
        seen.add(label)
        picked.push(String(row.period))
      }
    }
    const lastPeriod = chartData.at(-1)?.period
    if (lastPeriod && !picked.includes(String(lastPeriod))) picked.push(String(lastPeriod))
    return picked
  })()

  return (
    <Card className="col-span-1 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Evolução do patrimônio
            </h3>
            {growth && (
              <span
                className={`text-xs font-medium ${
                  growth.amount >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {growth.amount >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(growth.amount))}
                {growth.percent !== null && (
                  <span className="ml-1 text-slate-400">
                    ({growth.amount >= 0 ? "+" : "−"}
                    {Math.abs(growth.percent).toFixed(0)}%)
                  </span>
                )}
                <span className="ml-1 text-slate-400">no período</span>
              </span>
            )}
          </div>
          {lines.length > 1 && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {lines.map((line) => (
                <span
                  key={line.key}
                  className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: line.color }}
                    aria-hidden
                  />
                  {line.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {hasAssets && (
          <SegmentedControl
            ariaLabel="Detalhe do patrimônio"
            value={view}
            onChange={setView}
            options={[
              { value: "total", label: "Total" },
              { value: "breakdown", label: "Por ativo" },
            ]}
          />
        )}
      </div>

      {isEmpty ? (
        <div className="flex h-72 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem histórico ainda
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 10, top: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={GRID_COLOR}
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis
                dataKey="period"
                tickFormatter={(p) => formatPeriodLabel(p, granularity)}
                tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                ticks={ticks}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrency(v).replace("R$", "").trim()}
                width={78}
                // Ancora no zero quando não há valor negativo, em vez de deixar
                // o recharts inventar um piso abaixo de zero.
                domain={[(dataMin: number) => (dataMin < 0 ? dataMin : 0), "auto"]}
              />
              <Tooltip content={<CustomTooltip granularity={granularity} />} />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={line.width}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
