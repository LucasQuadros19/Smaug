import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { currentMonth, formatMonthLabel, shiftMonth } from "../../lib/format"

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

const arrow =
  "rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"

export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string
  onChange: (month: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const box = useRef<HTMLDivElement>(null)
  const today = currentMonth()

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

  return (
    <div
      ref={box}
      className="relative flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 dark:border-white/10 dark:bg-white/5"
    >
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(shiftMonth(month, -1))} className={arrow}>
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setYear(Number(month.slice(0, 4)))
          setOpen(!open)
        }}
        className="min-w-[140px] rounded-lg px-2 py-1 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
      >
        {formatMonthLabel(month)}
      </button>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(shiftMonth(month, 1))} className={arrow}>
        <ChevronRight size={16} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Escolher mês e ano"
          className="absolute inset-x-0 top-full z-40 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#12141e]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)} className={arrow}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800 tabular-nums dark:text-slate-100">{year}</span>
            <button type="button" aria-label="Próximo ano" onClick={() => setYear(year + 1)} className={arrow}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, index) => {
              const value = `${year}-${String(index + 1).padStart(2, "0")}`
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={value === month}
                  onClick={() => {
                    onChange(value)
                    setOpen(false)
                  }}
                  className={clsx(
                    "rounded-lg py-1.5 text-xs font-medium transition-colors",
                    value === month
                      ? "bg-indigo-600 text-white"
                      : value === today
                        ? "text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50 ring-inset dark:text-indigo-300 dark:ring-indigo-500/30 dark:hover:bg-indigo-500/10"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                  )}
                >
                  {name}
                </button>
              )
            })}
          </div>
          {month !== today && (
            <button
              type="button"
              onClick={() => {
                onChange(today)
                setOpen(false)
              }}
              className="mt-2 w-full rounded-lg py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
            >
              Voltar para o mês atual
            </button>
          )}
        </div>
      )}
    </div>
  )
}
