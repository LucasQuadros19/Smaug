import { Trash2 } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { formatCurrency, formatDate } from "../../lib/format"
import type { PlaylistExpectation } from "../../types"

export function ExpectationRow({
  expectation,
  onLaunch,
  onRenew,
  onDelete,
}: {
  expectation: PlaylistExpectation
  onLaunch: () => void
  onRenew: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3",
        expectation.is_overdue
          ? "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/5"
          : "border-slate-100 dark:border-white/5"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {expectation.description}
        </p>
        <p
          className={clsx(
            "text-xs",
            expectation.is_overdue ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
          )}
        >
          {expectation.is_overdue
            ? `Atrasado desde ${formatDate(expectation.expected_date)}`
            : `Esperado em ${formatDate(expectation.expected_date)}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {formatCurrency(expectation.amount)}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onRenew}>
            Renovar
          </Button>
          <Button onClick={onLaunch}>Lançar</Button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
