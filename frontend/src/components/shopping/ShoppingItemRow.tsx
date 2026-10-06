import { Check, Pencil, Trash2 } from "lucide-react"
import clsx from "clsx"
import { formatCurrency } from "../../lib/format"
import { PRIORITY_LABELS, PRIORITY_STYLES } from "../../lib/shopping"
import type { ShoppingItem } from "../../types"

export function ShoppingItemRow({
  item,
  onTogglePurchased,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem
  onTogglePurchased: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const priorityStyle = PRIORITY_STYLES[item.priority]

  return (
    <div
      className={clsx(
        "group flex items-start gap-3 rounded-xl border p-3 transition-colors",
        item.purchased
          ? "border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02]"
          : "border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]"
      )}
    >
      <button
        onClick={onTogglePurchased}
        aria-label={item.purchased ? "Desmarcar" : "Marcar como comprado"}
        className={clsx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          item.purchased
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 hover:border-indigo-500 dark:border-white/20"
        )}
      >
        {item.purchased && <Check size={13} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "text-sm font-medium",
              item.purchased
                ? "text-slate-400 line-through"
                : "text-slate-800 dark:text-slate-100"
            )}
          >
            {item.description}
          </span>
          {!item.purchased && (
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                priorityStyle.badge
              )}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="mt-0.5 truncate text-xs text-slate-400" title={item.notes}>
            {item.notes}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {item.amount !== null && (
          <span
            className={clsx(
              "text-sm font-semibold",
              item.purchased ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"
            )}
          >
            {formatCurrency(item.amount)}
          </span>
        )}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <Pencil size={15} />
          </button>
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
