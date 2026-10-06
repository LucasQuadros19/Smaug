import clsx from "clsx"
import { formatCurrency, formatDate } from "../../lib/format"
import type { Goal } from "../../types"

/** Barra + números de uma meta. Usada na tela de Metas e no Dashboard. */
export function GoalProgress({ goal }: { goal: Goal }) {
  const percent = Math.round(goal.progress * 100)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
          <span>{goal.icon}</span>
          <span className="truncate font-medium">{goal.name}</span>
        </span>
        <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">
          {formatCurrency(goal.current)}
          <span className="text-slate-400"> / {formatCurrency(goal.target_amount)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className={clsx(
            "h-full rounded-full transition-all",
            goal.done ? "bg-emerald-500" : goal.overdue ? "bg-rose-500" : "bg-indigo-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        {goal.done
          ? "Meta batida 🎉"
          : goal.overdue
            ? `Passou do prazo (${formatDate(goal.deadline!)}) · faltam ${formatCurrency(goal.remaining)}`
            : goal.monthly_needed !== null
              ? `${percent}% · guarde ${formatCurrency(goal.monthly_needed)}/mês até ${formatDate(goal.deadline!)}`
              : `${percent}% · faltam ${formatCurrency(goal.remaining)}`}
        {" · "}
        {goal.playlist ? `${goal.playlist.icon} ${goal.playlist.name}` : "patrimônio total"}
      </p>
    </div>
  )
}
