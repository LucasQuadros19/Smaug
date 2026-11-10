import { useState, type ReactNode } from "react"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "../ui/Card"
import { SegmentedControl } from "../ui/SegmentedControl"
import { formatCurrency, todayISO } from "../../lib/format"
import { useTheme } from "../../context/ThemeContext"
import { AXIS_COLOR, GRID_COLOR, NEGATIVE, POSITIVE, analyticsPeriod, analyticsTick, seriesColor } from "../../lib/chartTheme"
import type { AnalyticsGranularity, AnalyticsPeriod } from "../../types"

type View = "leftover" | "flow"

export type LeftoverPoint = AnalyticsPeriod & { leftover: number; accumulated: number }

function LeftoverTooltip({ active, payload, granularity }: any) {
  if (!active || !payload?.length) return null
  const point: LeftoverPoint = payload[0].payload
  const rows = [
    { label: "Entrou", value: point.income, color: POSITIVE },
    { label: "Saiu", value: -point.expense, color: NEGATIVE },
    { label: point.informed === null ? "Sobrou" : "Sobra calculada", value: point.leftover },
    ...(point.informed === null ? [] : [{ label: "Sobra informada", value: point.informed }]),
    { label: "Sobra acumulada", value: point.accumulated },
  ]
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">{analyticsPeriod(point.period, granularity)}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            {row.color && <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />}
            {row.label}
          </span>
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(row.value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Ponta arredondada só do lado de fora: a base fica reta no zero, para cima ou para baixo. */
function SignedBar(props: any) {
  const value = Array.isArray(props.value) ? props.value[1] - props.value[0] : (props.value ?? 0)
  const negative = value < 0
  return <Rectangle {...props} radius={negative ? [0, 0, 4, 4] : [4, 4, 0, 0]} />
}

export function LeftoverChart({
  points,
  granularity,
  selected,
  onSelect,
  footer,
}: {
  points: LeftoverPoint[]
  granularity: AnalyticsGranularity
  selected: string | null
  onSelect: (period: string) => void
  /** Embaixo do gráfico: o campo para digitar a sobra do mês. */
  footer?: ReactNode
}) {
  const [view, setView] = useState<View>("leftover")
  const { theme } = useTheme()
  const dim = (period: string) => (selected && selected !== period ? 0.35 : 1)
  // Com sobra digitada, as barras são ela e a calculada vira linha para comparar.
  const informed = points.some((p) => p.informed !== null)
  const lineColor = seriesColor(0, theme === "dark")
  // A linha para no período atual: mês que ainda não chegou não "sobrou zero".
  const today = todayISO()

  return (
    <Card className="xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Quanto sobrou</h3>
          <p className="mt-1 text-xs text-slate-400">
            {view === "flow"
              ? "Entradas e saídas lado a lado"
              : informed
                ? "Barras: o que você informou · linha: entradas menos saídas"
                : "Entradas menos saídas em cada período"}{" "}
            · clique
            numa barra para ver as categorias dela
          </p>
        </div>
        <SegmentedControl
          ariaLabel="O que mostrar no gráfico"
          value={view}
          onChange={setView}
          options={[
            { value: "leftover", label: "Sobra" },
            { value: "flow", label: "Entradas e saídas" },
          ]}
        />
      </div>

      {view === "leftover" && informed && (
        <div className="mb-2 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: POSITIVE }} aria-hidden />
            Sobra informada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: lineColor }} aria-hidden />
            Sobra calculada
          </span>
        </div>
      )}
      {view === "flow" && (
        <div className="mb-2 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: POSITIVE }} aria-hidden />
            Entradas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: NEGATIVE }} aria-hidden />
            Saídas
          </span>
        </div>
      )}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ left: 0, right: 8, top: 10 }}
            barGap={2}
            onClick={(state) => state?.activeLabel != null && onSelect(String(state.activeLabel))}
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
              content={<LeftoverTooltip granularity={granularity} />}
              cursor={{ fill: GRID_COLOR, fillOpacity: 0.08 }}
            />
            <ReferenceLine y={0} stroke={AXIS_COLOR} strokeOpacity={0.4} />
            {view === "leftover" ? (
              [
                <Bar key="bar" dataKey={informed ? "informed" : "leftover"} name="Sobrou" maxBarSize={24} shape={SignedBar}>
                  {points.map((p) => (
                    <Cell
                      key={p.period}
                      fill={(informed ? (p.informed ?? 0) : p.leftover) < 0 ? NEGATIVE : POSITIVE}
                      fillOpacity={dim(p.period)}
                    />
                  ))}
                </Bar>,
                informed && (
                  <Line
                    key="line"
                    dataKey={(p: LeftoverPoint) => (p.start > today ? null : p.leftover)}
                    name="Sobra calculada"
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: lineColor }}
                    isAnimationActive={false}
                  />
                ),
              ]
            ) : (
              [
                <Bar key="income" dataKey="income" name="Entradas" maxBarSize={14} radius={[4, 4, 0, 0]} fill={POSITIVE}>
                  {points.map((p) => (
                    <Cell key={p.period} fillOpacity={dim(p.period)} />
                  ))}
                </Bar>,
                <Bar key="expense" dataKey="expense" name="Saídas" maxBarSize={14} radius={[4, 4, 0, 0]} fill={NEGATIVE}>
                  {points.map((p) => (
                    <Cell key={p.period} fillOpacity={dim(p.period)} />
                  ))}
                </Bar>,
              ]
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {footer}
    </Card>
  )
}
