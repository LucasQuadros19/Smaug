import { Pencil, Trash2 } from "lucide-react"
import type { Category } from "../../types"

export function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 dark:border-white/5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `${category.color}20` }}
        >
          {category.icon}
        </span>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{category.name}</span>
      </div>
      <div className="flex gap-1">
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
  )
}
