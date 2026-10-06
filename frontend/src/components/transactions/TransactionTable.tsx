import { Pencil, Trash2 } from "lucide-react"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { formatCurrency, formatDate } from "../../lib/format"
import { getAmountColorClass } from "../../lib/transactionDisplay"
import type { Transaction } from "../../types"

export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  showPlaylist = true,
}: {
  transactions: Transaction[]
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  showPlaylist?: boolean
}) {
  if (transactions.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-400">Nenhuma transação encontrada.</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-white/5">
            <th className="px-5 py-3 font-medium">Descrição</th>
            <th className="px-5 py-3 font-medium">Categoria</th>
            <th className="px-5 py-3 font-medium">Conta</th>
            {showPlaylist && <th className="px-5 py-3 font-medium">Grupo</th>}
            <th className="px-5 py-3 font-medium">Data</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {transactions.map((tx) => (
            <tr key={tx.id} className="group">
              <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{tx.description}</td>
              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                {tx.category ? `${tx.category.icon} ${tx.category.name}` : "—"}
              </td>
              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{tx.account_name}</td>
              {showPlaylist && (
                <td className="px-5 py-3">
                  {tx.playlist ? (
                    <Badge color={tx.playlist.color}>
                      {tx.playlist.icon} {tx.playlist.name}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              )}
              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(tx.date)}</td>
              <td className={`px-5 py-3 text-right font-semibold ${getAmountColorClass(tx)}`}>
                {tx.type === "income" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onEdit(tx)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(tx)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
