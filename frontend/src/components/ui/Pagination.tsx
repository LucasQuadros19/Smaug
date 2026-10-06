import { ChevronLeft, ChevronRight } from "lucide-react"

export function Pagination({
  page,
  pages,
  total,
  perPage,
  onChange,
  label = "itens",
}: {
  page: number
  pages: number
  total: number
  perPage: number
  onChange: (page: number) => void
  label?: string
}) {
  if (total === 0) return null

  const first = (page - 1) * perPage + 1
  const last = Math.min(page * perPage, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-sm">
      <p className="text-xs text-slate-400">
        {first}–{last} de {total} {label}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-white/5"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[80px] text-center text-xs text-slate-500 dark:text-slate-400">
            {page} de {pages}
          </span>
          <button
            onClick={() => onChange(page + 1)}
            disabled={page >= pages}
            aria-label="Próxima página"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-white/5"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
