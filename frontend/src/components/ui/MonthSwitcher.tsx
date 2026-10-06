import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatMonthLabel, shiftMonth } from "../../lib/format"

export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string
  onChange: (month: string) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 dark:border-white/10 dark:bg-white/5">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium text-slate-700 dark:text-slate-200">
        {formatMonthLabel(month)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
