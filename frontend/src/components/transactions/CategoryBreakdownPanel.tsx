import clsx from "clsx"
import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import type { CategoryBreakdown } from "../../types"

export function CategoryBreakdownPanel({
  items,
  selectedId,
  onSelect,
}: {
  items: CategoryBreakdown[]
  selectedId?: number
  onSelect: (categoryId: number | undefined) => void
}) {
  if (items.length === 0) return null

  const total = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Gastos por categoria
        </h3>
        <span className="text-xs text-slate-400">
          {formatCurrency(total)} no filtro atual
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const percent = total > 0 ? (item.total / total) * 100 : 0
          const active = selectedId === item.category_id
          return (
            <li key={item.category_id ?? "none"}>
              <button
                type="button"
                onClick={() =>
                  onSelect(active || item.category_id == null ? undefined : item.category_id)
                }
                disabled={item.category_id == null}
                className={clsx(
                  "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
                  item.category_id == null
                    ? "cursor-default"
                    : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                  active && "bg-indigo-50 dark:bg-indigo-500/10"
                )}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {item.icon} {item.name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{item.count}x</span>
                  </span>
                  <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">
                    {formatCurrency(item.total)}
                    <span className="ml-1 text-xs text-slate-400">({Math.round(percent)}%)</span>
                  </span>
                </div>
                {/* Barra fina: dá a proporção sem virar mais um gráfico. */}
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: item.color }}
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {items.some((i) => i.category_id != null) && (
        <p className="mt-3 text-xs text-slate-400">
          Clique numa categoria para filtrar só ela.
        </p>
      )}
    </Card>
  )
}
