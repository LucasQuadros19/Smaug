import { Search } from "lucide-react"
import { Input, Select } from "../ui/Input"
import { SegmentedControl } from "../ui/SegmentedControl"
import { useAccounts } from "../../hooks/useAccounts"
import { useCategories } from "../../hooks/useCategories"
import { usePlaylists } from "../../hooks/usePlaylists"
import { isoDate } from "../../lib/format"
import type { TransactionFilters as Filters } from "../../api/transactions"
import type { TransactionScope } from "../../types"

export function TransactionFilters({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
}) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: playlists } = usePlaylists()

  const hasAny = Boolean(
    filters.search ||
      filters.type ||
      filters.account_id ||
      filters.category_id ||
      filters.playlist_id ||
      filters.start_date ||
      filters.end_date ||
      filters.scope
  )

  /** Atalhos de período — o filtro manual continua disponível abaixo. */
  const setRange = (days: number | null) => {
    if (days === null) {
      onChange({ ...filters, start_date: undefined, end_date: undefined })
      return
    }
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    onChange({ ...filters, start_date: isoDate(start), end_date: isoDate(end) })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          ariaLabel="O que mostrar"
          value={filters.scope ?? "all"}
          onChange={(v) =>
            onChange({ ...filters, scope: v === "all" ? undefined : (v as TransactionScope) })
          }
          options={[
            { value: "all", label: "Tudo" },
            { value: "cash", label: "Só caixa" },
            { value: "transfers", label: "Só transferências" },
          ]}
        />
        <span className="mr-1 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden />
        {[
          { label: "30 dias", days: 30 },
          { label: "90 dias", days: 90 },
          { label: "1 ano", days: 365 },
          { label: "Tudo", days: null },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setRange(preset.days)}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            {preset.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            className="w-auto py-1 text-xs"
            value={filters.start_date ?? ""}
            onChange={(e) => onChange({ ...filters, start_date: e.target.value || undefined })}
          />
          <span className="text-xs text-slate-400">até</span>
          <Input
            type="date"
            aria-label="Data final"
            className="w-auto py-1 text-xs"
            value={filters.end_date ?? ""}
            onChange={(e) => onChange({ ...filters, end_date: e.target.value || undefined })}
          />
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="relative lg:col-span-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Buscar por descrição..."
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
      </div>
      <Select
        value={filters.type ?? ""}
        onChange={(e) => onChange({ ...filters, type: (e.target.value || undefined) as Filters["type"] })}
      >
        <option value="">Todos os tipos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
      </Select>
      <Select
        value={filters.account_id ?? ""}
        onChange={(e) =>
          onChange({ ...filters, account_id: e.target.value ? Number(e.target.value) : undefined })
        }
      >
        <option value="">Todas as contas</option>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Select
        value={filters.category_id ?? ""}
        onChange={(e) =>
          onChange({ ...filters, category_id: e.target.value ? Number(e.target.value) : undefined })
        }
      >
        <option value="">Todas as categorias</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </Select>
      <Select
        value={filters.playlist_id ?? ""}
        onChange={(e) =>
          onChange({ ...filters, playlist_id: e.target.value ? Number(e.target.value) : undefined })
        }
      >
        <option value="">Todos os grupos</option>
        {playlists?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.icon} {p.name}
          </option>
        ))}
        </Select>
      </div>
    </div>
  )
}
