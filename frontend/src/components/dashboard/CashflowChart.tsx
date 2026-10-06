import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "../ui/Card"
import { SegmentedControl } from "../ui/SegmentedControl"
import { formatCurrency } from "../../lib/format"
import {
  AXIS_COLOR,
  GRID_COLOR,
  NEGATIVE,
  POSITIVE,
  formatPeriodFull,
  formatPeriodLabel,
} from "../../lib/chartTheme"
import type { CashflowPoint, Granularity } from "../../types"

function CustomTooltip({ active, payload, label, granularity }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
      <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">
        {formatPeriodFull(label, granularity)}
      </p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.dataKey === "income" ? "Receitas" : "Despesas"}:{" "}
          {formatCurrency(Math.abs(entry.value))}
        </p>
      ))}
    </div>
  )
}

export function CashflowChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data: CashflowPoint[]
  granularity: Granularity
  onGranularityChange: (granularity: Granularity) => void
}) {
  const chartData = data.map((point) => ({
    period: point.period,
    income: point.income,
    expenseNeg: -point.expense,
  }))

  return (
    <Card className="col-span-1 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Fluxo de caixa
          </h3>
          <div className="mt-1 flex gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: POSITIVE }} aria-hidden />
              Receitas
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NEGATIVE }} aria-hidden />
              Despesas
            </span>
          </div>
        </div>
        <SegmentedControl
          ariaLabel="Período do fluxo de caixa"
          value={granularity}
          onChange={onGranularityChange}
          options={[
            { value: "monthly", label: "Mensal" },
            { value: "weekly", label: "Semanal" },
          ]}
        />
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 10 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={POSITIVE} stopOpacity={0.35} />
                <stop offset="95%" stopColor={POSITIVE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={NEGATIVE} stopOpacity={0} />
                <stop offset="95%" stopColor={NEGATIVE} stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} strokeOpacity={0.15} vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={(p) => formatPeriodLabel(p, granularity)}
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(Math.abs(v)).replace("R$", "").trim()}
              width={70}
            />
            <Tooltip content={<CustomTooltip granularity={granularity} />} />
            <ReferenceLine y={0} stroke={AXIS_COLOR} strokeOpacity={0.3} />
            <Area
              type="monotone"
              dataKey="income"
              stroke={POSITIVE}
              strokeWidth={2}
              fill="url(#incomeGradient)"
            />
            <Area
              type="monotone"
              dataKey="expenseNeg"
              stroke={NEGATIVE}
              strokeWidth={2}
              fill="url(#expenseGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
