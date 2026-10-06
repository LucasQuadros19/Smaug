import { useState } from "react"
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "../ui/Card"
import { SegmentedControl } from "../ui/SegmentedControl"
import { useTheme } from "../../context/ThemeContext"
import { formatCurrency } from "../../lib/format"
import { AXIS_COLOR, seriesColor } from "../../lib/chartTheme"
import type { AllocationItem } from "../../types"

type ViewKind = "group" | "item"

interface Slice {
  label: string
  icon: string
  value: number
  color: string
}

const GROUP_ORDER = ["Contas", "Ativos", "Grupos"] as const

function CustomTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const pct = total > 0 ? Math.round((data.value / total) * 100) : 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="font-medium text-slate-700 dark:text-slate-200">
        {data.icon} {data.label}
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        {formatCurrency(data.value)} ({pct}%)
      </p>
    </div>
  )
}

export function AllocationChart({
  allocation,
  liabilities = 0,
}: {
  allocation: AllocationItem[]
  /** Passivos (negativo). Uma rosca não representa fatia negativa, então eles
   *  ficam de fora do desenho e aparecem como nota de rodapé. */
  liabilities?: number
}) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [view, setView] = useState<ViewKind>("group")

  const total = allocation.reduce((sum, i) => sum + i.value, 0)

  // Por grupo: 3 fatias, ordem fixa (Contas, Ativos, Grupos).
  const byGroup: Slice[] = GROUP_ORDER.map((group, index) => ({
    label: group as string,
    icon: group === "Contas" ? "🏦" : group === "Ativos" ? "🏛️" : "📁",
    value: allocation.filter((i) => i.group === group).reduce((sum, i) => sum + i.value, 0),
    color: seriesColor(index, isDark),
  })).filter((g) => g.value > 0)

  // Por item: mantém a ordem recebida (maior → menor); a partir do 6º, "Outros".
  const items: Slice[] = allocation.map((item, index) => ({
    label: item.label,
    icon: item.icon,
    value: item.value,
    color: seriesColor(index, isDark),
  }))
  const rest = items.slice(5)
  const byItem: Slice[] =
    rest.length > 0
      ? [
          ...items.slice(0, 5),
          {
            label: "Outros",
            icon: "•",
            value: rest.reduce((sum, i) => sum + i.value, 0),
            color: seriesColor(5, isDark),
          },
        ]
      : items

  const data: Slice[] = view === "group" ? byGroup : byItem

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Onde está o dinheiro
        </h3>
        {allocation.length > 0 && (
          <SegmentedControl
            ariaLabel="Detalhe da composição"
            value={view}
            onChange={setView}
            options={[
              { value: "group", label: "Por tipo" },
              { value: "item", label: "Por item" },
            ]}
          />
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nada registrado ainda
        </div>
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              {data.length > 6 ? (
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={92}
                  />
                  <Tooltip content={<CustomTooltip total={total} />} cursor={{ fill: "transparent" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {data.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={data.length > 1 ? 2 : 0}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip total={total} />} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          <ul className="mt-2 space-y-2">
            {data.map((entry) => (
              <li key={entry.label} className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  <span className="truncate">
                    {entry.icon} {entry.label}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">
                  {formatCurrency(entry.value)}
                  <span className="ml-1 text-xs text-slate-400">
                    ({total > 0 ? Math.round((entry.value / total) * 100) : 0}%)
                  </span>
                </span>
              </li>
            ))}
            {liabilities < 0 && (
              <li className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm dark:border-white/5">
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  🧾 Dívidas
                </span>
                <span className="shrink-0 font-medium text-rose-600 dark:text-rose-400">
                  {formatCurrency(liabilities)}
                </span>
              </li>
            )}
          </ul>
          {liabilities < 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Patrimônio líquido: {formatCurrency(total + liabilities)} — dívidas não aparecem na
              rosca por não serem uma fatia do bolo.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
