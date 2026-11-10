import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "../ui/Card"
import { useTheme } from "../../context/ThemeContext"
import { formatCurrency } from "../../lib/format"
import { AXIS_COLOR, GRID_COLOR, analyticsPeriod, analyticsTick, surfaceColor } from "../../lib/chartTheme"
import type { AnalyticsGranularity, AnalyticsPeriod, CategoryBreakdown } from "../../types"

const OTHERS = { key: "outras", name: "Outras", icon: "", color: "#94a3b8" }
const MAX_SERIES = 6

function StackTooltip({ active, payload, granularity }: any) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((entry: any) => entry.value > 0).reverse()
  const total = rows.reduce((sum: number, entry: any) => sum + entry.value, 0)
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">
        {analyticsPeriod(payload[0].payload.period, granularity, payload[0].payload)} · {formatCurrency(total)}
      </p>
      {rows.length === 0 && <p className="text-slate-400">Sem gastos</p>}
      {rows.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Gasto de cada período empilhado por categoria: a barra mais alta é onde mais gastou, as cores dizem com o quê. */
export function CategoryPeriodChart({
  periods,
  categories,
  granularity,
  selectedPeriod,
  selectedCategory,
  onSelectPeriod,
}: {
  periods: AnalyticsPeriod[]
  categories: CategoryBreakdown[]
  granularity: AnalyticsGranularity
  selectedPeriod: string | null
  selectedCategory?: number
  onSelectPeriod: (period: string) => void
}) {
  const { theme } = useTheme()
  const focused = categories.find((c) => c.category_id != null && c.category_id === selectedCategory)
  // Cor da própria categoria, a mesma do Caixa e do Dashboard. Da 7ª em diante vira "Outras".
  const shown = (focused ? [focused] : categories.slice(0, MAX_SERIES)).map((c) => ({
    key: String(c.category_id ?? 0),
    name: `${c.icon} ${c.name}`,
    color: c.color,
  }))
  const series = !focused && categories.length > MAX_SERIES ? [...shown, OTHERS] : shown
  const data = periods.map((p) => {
    const row: Record<string, number | string> = { period: p.period, start: p.start, end: p.end }
    let rest = p.expense
    for (const s of shown) {
      row[s.key] = p.categories[s.key]?.total ?? 0
      rest -= row[s.key] as number
    }
    if (series.includes(OTHERS)) row[OTHERS.key] = Math.max(rest, 0)
    return row
  })
  const dim = (period: string) => (selectedPeriod && selectedPeriod !== period ? 0.35 : 1)

  return (
    <Card className="xl:col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {focused ? `${focused.icon} ${focused.name} em cada período` : "Gastos por categoria em cada período"}
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          {focused ? "Escolha outra categoria ao lado ou clique nela de novo para ver todas" : "A barra mais alta é onde você mais gastou"}
        </p>
      </div>

      {series.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-400">Sem gastos neste período</div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ left: 0, right: 8, top: 10 }}
                onClick={(state) => state?.activeLabel != null && onSelectPeriod(String(state.activeLabel))}
                className="cursor-pointer"
              >
                <CartesianGrid stroke={GRID_COLOR} strokeOpacity={0.15} vertical={false} />
                <XAxis
                  dataKey="period"
                  tickFormatter={(p) => analyticsTick(p, granularity)}
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  interval="equidistantPreserveStart"
                  minTickGap={8}
                />
                <YAxis
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v).replace("R$", "").replace(/,00$/, "").trim()}
                  width={70}
                />
                <Tooltip
                  content={<StackTooltip granularity={granularity} />}
                  cursor={{ fill: GRID_COLOR, fillOpacity: 0.08 }}
                />
                {series.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="gastos"
                    fill={s.color}
                    stroke={surfaceColor(theme === "dark")}
                    strokeWidth={1}
                    maxBarSize={24}
                  >
                    {data.map((row) => (
                      <Cell key={row.period as string} fillOpacity={dim(row.period as string)} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                {s.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
