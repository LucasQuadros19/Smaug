import { useId } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AXIS_COLOR, GRID_COLOR, NEGATIVE, POSITIVE } from "../../lib/chartTheme"
import type { MarketRange } from "../../types"

export type ChartPoint = { t: number; v: number; invested?: number }

const INTRADAY: MarketRange[] = ["1d", "5d"]

function formatTick(t: number, range: MarketRange) {
  const d = new Date(t)
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (range === "1d") return hm
  if (range === "5d") return d.toLocaleDateString("pt-BR", { weekday: "short" })
  if (range === "5y") return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

/** Linha de preço: verde se o período subiu, vermelha se caiu. `invested`
 *  (opcional) desenha o quanto foi aplicado, para ver se está acima ou abaixo. */
export function PriceChart({
  data,
  range,
  format,
  height = 220,
}: {
  data: ChartPoint[]
  range: MarketRange
  format: (value: number) => string
  height?: number
}) {
  const gradient = useId()
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        Sem dados para esse período
      </div>
    )
  }
  const up = data[data.length - 1].v >= data[0].v
  const color = up ? POSITIVE : NEGATIVE
  const hasInvested = data.some((p) => p.invested !== undefined)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} strokeOpacity={0.15} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t) => formatTick(t, range)}
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v) => format(v)}
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={84}
        />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
                <p className="mb-1 text-slate-500 dark:text-slate-400">
                  {new Date(label as number).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    ...(INTRADAY.includes(range) ? { hour: "2-digit", minute: "2-digit" } : {}),
                  })}
                </p>
                {payload.map((entry) => (
                  <p key={String(entry.dataKey)} className="font-medium text-slate-800 dark:text-slate-100">
                    {entry.dataKey === "invested" ? "Investido: " : hasInvested ? "Valor: " : ""}
                    {format(entry.value as number)}
                  </p>
                ))}
              </div>
            ) : null
          }
        />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradient})`} isAnimationActive={false} />
        {hasInvested && (
          <Line
            type="stepAfter"
            dataKey="invested"
            stroke={AXIS_COLOR}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
