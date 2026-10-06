import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "../ui/Card"
import { useTheme } from "../../context/ThemeContext"
import { formatCurrency, formatDate } from "../../lib/format"
import { AXIS_COLOR, GRID_COLOR, seriesColor } from "../../lib/chartTheme"
import type { PositionHistory } from "../../types"

function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="mb-0.5 font-medium text-slate-600 dark:text-slate-300">{formatDate(label)}</p>
      <p className="text-slate-500 dark:text-slate-400">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function PositionTimeline({ history }: { history: PositionHistory }) {
  const { theme } = useTheme()
  const color = seriesColor(0, theme === "dark")

  const { series, days_held: daysHeld, peak, first_funded: firstFunded, playlist } = history
  const current = playlist.outstanding ?? 0

  if (series.length === 0) {
    return (
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Linha do tempo
        </h3>
        <p className="text-sm text-slate-400">
          Sem histórico ainda. Cada registro no Patrimônio vira um ponto aqui.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Linha do tempo
        </h3>
        <div className="flex flex-wrap gap-5 text-sm">
          <div>
            <p className="text-xs text-slate-400">Hoje</p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(current)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Máximo já atingido</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(peak)}
            </p>
          </div>
          {daysHeld != null && (
            <div>
              <p className="text-xs text-slate-400">Parado há</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {daysHeld} dias
                {firstFunded && (
                  <span className="ml-1 text-xs text-slate-400">
                    (desde {formatDate(firstFunded)})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ left: 0, right: 10, top: 10 }}>
            <defs>
              <linearGradient id="positionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={GRID_COLOR}
              strokeOpacity={0.15}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(d).slice(3)}
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v).replace("R$", "").trim()}
              width={78}
              domain={[(min: number) => (min < 0 ? min : 0), "auto"]}
            />
            <Tooltip content={<TimelineTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#positionGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
