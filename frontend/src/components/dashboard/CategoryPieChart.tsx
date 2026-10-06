import { useState } from "react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "../ui/Card"
import { SegmentedControl } from "../ui/SegmentedControl"
import { formatCurrency } from "../../lib/format"
import { AXIS_COLOR } from "../../lib/chartTheme"
import type { CategoryExpense } from "../../types"

type ViewKind = "donut" | "pie" | "bar"

function CustomTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const data = entry.payload
  const pct = total > 0 ? Math.round((data.total / total) * 100) : 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="font-medium text-slate-700 dark:text-slate-200">
        {data.icon} {data.name}
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        {formatCurrency(data.total)} ({pct}%)
      </p>
    </div>
  )
}

export function CategoryPieChart({ data }: { data: CategoryExpense[] }) {
  const [view, setView] = useState<ViewKind>("donut")
  const total = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Gastos por categoria
        </h3>
        {data.length > 0 && (
          <SegmentedControl
            ariaLabel="Tipo de visualização"
            value={view}
            onChange={setView}
            options={[
              { value: "donut", label: "Rosca" },
              { value: "pie", label: "Pizza" },
              { value: "bar", label: "Barras" },
            ]}
          />
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem despesas neste mês
        </div>
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              {view === "bar" ? (
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={92}
                  />
                  <Tooltip content={<CustomTooltip total={total} />} cursor={{ fill: "transparent" }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={16}>
                    {data.map((entry) => (
                      <Cell key={entry.category_id} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={view === "donut" ? 55 : 0}
                    outerRadius={80}
                    paddingAngle={data.length > 1 ? 2 : 0}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.category_id} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip total={total} />} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          <ul className="mt-2 space-y-2">
            {data.slice(0, 5).map((entry) => (
              <li key={entry.category_id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  {entry.icon} {entry.name}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {formatCurrency(entry.total)}
                  <span className="ml-1 text-xs text-slate-400">
                    ({total > 0 ? Math.round((entry.total / total) * 100) : 0}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
