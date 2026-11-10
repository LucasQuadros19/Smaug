import clsx from "clsx"
import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from "lucide-react"
import type { DragEvent } from "react"
import type { Category } from "../../types"

const iconButton =
  "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-white/5 dark:hover:text-slate-200"

export function CategoryRow({
  category,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDrop,
  dragging,
}: {
  category: Category
  onEdit: () => void
  onDelete: () => void
  /** Ausentes na primeira/última da lista. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDragStart: () => void
  onDrop: () => void
  dragging: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart()
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      className={clsx(
        "flex items-center justify-between gap-2 rounded-xl border border-slate-100 py-3 pl-2 pr-3 dark:border-white/5",
        dragging && "opacity-40"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <GripVertical size={16} className="shrink-0 cursor-grab text-slate-300 dark:text-slate-600" aria-hidden />
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
          style={{ backgroundColor: `${category.color}20` }}
        >
          {category.icon}
        </span>
        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{category.name}</span>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button type="button" onClick={onMoveUp} disabled={!onMoveUp} aria-label={`Subir ${category.name}`} className={iconButton}>
          <ChevronUp size={15} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={!onMoveDown} aria-label={`Descer ${category.name}`} className={iconButton}>
          <ChevronDown size={15} />
        </button>
        <button type="button" onClick={onEdit} aria-label={`Editar ${category.name}`} className={iconButton}>
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir ${category.name}`}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
