import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { Card } from "../ui/Card"
import { useTheme } from "../../context/ThemeContext"
import { formatCurrency } from "../../lib/format"
import { AXIS_COLOR, GRID_COLOR, WEEKDAYS, seriesColor } from "../../lib/chartTheme"
import type { Analytics } from "../../types"

function WeekdayTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const day = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(day.average)} por dia</p>
      <p className="text-slate-500 dark:text-slate-400">
        {WEEKDAYS[day.weekday]} · {formatCurrency(day.total)} no total
      </p>
    </div>
  )
}

/** Média de gasto por dia da semana: o dia mais caro em destaque, os outros em cinza. */
export function WeekdayChart({ weekdays }: { weekdays: Analytics["weekdays"] }) {
  const { theme } = useTheme()
  const top = weekdays.reduce((best, day) => (day.average > best.average ? day : best), weekdays[0])
  const accent = seriesColor(0, theme === "dark")

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dia da semana</h3>
      <p className="mt-1 text-xs text-slate-400">
        {top && top.average > 0
          ? `Média de gasto por dia · mais ${top.weekday >= 5 ? "no" : "na"} ${WEEKDAYS[top.weekday].toLowerCase()} (${formatCurrency(top.average)})`
          : "Média de gasto por dia"}
      </p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekdays} margin={{ left: 0, right: 0, top: 10 }}>
            <XAxis
              dataKey="weekday"
              tickFormatter={(i) => WEEKDAYS[i].slice(0, 3)}
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<WeekdayTooltip />} cursor={{ fill: GRID_COLOR, fillOpacity: 0.08 }} />
            <Bar dataKey="average" maxBarSize={24} radius={[4, 4, 0, 0]}>
              {weekdays.map((day) => (
                <Cell key={day.weekday} fill={day === top && day.average > 0 ? accent : AXIS_COLOR} fillOpacity={day === top ? 1 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
