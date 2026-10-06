import { Bot, CalendarClock, Hand, Pencil, PlayCircle, Trash2 } from "lucide-react"
import { formatCurrency, formatDate } from "../../lib/format"
import { FREQUENCY_LABELS } from "../../lib/constants"
import type { RecurringTransaction } from "../../types"

/** Vencida ou vencendo hoje — comparação por string ISO, que já ordena certo. */
function estaVencida(item: RecurringTransaction) {
  return item.due_date <= new Date().toISOString().slice(0, 10)
}

export function RecurringRow({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleAuto,
  onLaunch,
  onPostpone,
}: {
  item: RecurringTransaction
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onToggleAuto: () => void
  onLaunch: () => void
  onPostpone: () => void
}) {
  const vencida = estaVencida(item)
  // Só faz sentido lançar à mão o que está no manual e não está pausado.
  const podeLancar = item.active && !item.auto

  return (
    <tr className={item.active ? "" : "opacity-50"}>
      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
        {item.category?.icon ?? "💰"} {item.description}
      </td>
      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{item.account_name}</td>
      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
        {FREQUENCY_LABELS[item.frequency]}
      </td>
      <td className="px-5 py-3">
        <span
          className={
            podeLancar && vencida
              ? "font-medium text-amber-600 dark:text-amber-400"
              : "text-slate-500 dark:text-slate-400"
          }
        >
          {formatDate(item.due_date)}
        </span>
        {podeLancar && vencida && (
          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">aguardando</span>
        )}
        {item.postponed_until && (
          <span className="block text-xs text-slate-400">adiada · era {formatDate(item.next_due_date)}</span>
        )}
      </td>
      <td
        className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${
          item.type === "income"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {item.type === "income" ? "+" : "-"}
        {formatCurrency(item.amount)}
      </td>

      <td className="px-5 py-3">
        <button
          onClick={onToggleAuto}
          title={
            item.auto
              ? "Automático: lança sozinha no vencimento. Clique para passar a manual."
              : "Manual: você lança o valor de cada período. Clique para automatizar."
          }
          // Tons por classe, não inline: o âmbar escuro some no tema escuro.
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${
            item.auto
              ? "bg-[#2a78d6]/15 text-[#1f5da8] dark:text-[#7cb2ec]"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          {item.auto ? <Bot size={13} /> : <Hand size={13} />}
          {item.auto ? "Automático" : "Manual"}
        </button>
      </td>

      <td className="px-5 py-3">
        <button
          onClick={onToggleActive}
          title={item.active ? "Clique para pausar" : "Clique para retomar"}
          className="rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
          style={{
            backgroundColor: item.active ? "#22c55e20" : "#64748b20",
            color: item.active ? "#16a34a" : "#64748b",
          }}
        >
          {item.active ? "Ativo" : "Pausado"}
        </button>
      </td>

      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          {podeLancar && (
            <button
              onClick={onLaunch}
              className={`mr-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                vencida
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              }`}
            >
              <PlayCircle size={14} /> Lançar
            </button>
          )}
          {item.active && (
            <button
              onClick={onPostpone}
              title="Adiar esta ocorrência"
              aria-label="Adiar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <CalendarClock size={15} />
            </button>
          )}
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
      </td>
    </tr>
  )
}
