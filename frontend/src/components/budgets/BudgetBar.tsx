import clsx from "clsx"
import { formatCurrency } from "../../lib/format"
import type { Budget } from "../../types"

export function BudgetBar({ budget }: { budget: Budget }) {
  const spent = budget.spent ?? 0
  const percent = Math.min(100, Math.round((spent / budget.limit_amount) * 100))
  const isOver = spent > budget.limit_amount
  const isClose = !isOver && percent >= 80

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          {budget.category?.icon} {budget.category?.name}
        </span>
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {formatCurrency(spent)}
          <span className="text-slate-400"> / {formatCurrency(budget.limit_amount)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className={clsx(
            "h-full rounded-full transition-all",
            isOver ? "bg-rose-500" : isClose ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
