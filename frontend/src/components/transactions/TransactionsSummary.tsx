import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import type { Transaction } from "../../types"

export function TransactionsSummary({
  transactions,
  totals,
}: {
  transactions: Transaction[]
  /** Somas de todo o filtro (vindas do servidor), não só da página visível. */
  totals?: { income: number; expense: number }
}) {
  const income = totals
    ? totals.income
    : transactions
        .filter((t) => t.type === "income" && !t.playlist)
        .reduce((sum, t) => sum + t.amount, 0)
  const expense = totals
    ? totals.expense
    : transactions
        .filter((t) => t.type === "expense" && !t.playlist)
        .reduce((sum, t) => sum + t.amount, 0)
  const transfers = transactions
    .filter((t) => t.playlist)
    .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0)

  return (
    <Card className="flex flex-wrap gap-6">
      <div>
        <p className="text-xs text-slate-400">Entradas</p>
        <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
          +{formatCurrency(income)}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-400">Saídas</p>
        <p className="text-lg font-semibold text-rose-600 dark:text-rose-400">
          -{formatCurrency(expense)}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-400">Saldo</p>
        <p
          className={`text-lg font-semibold ${
            income - expense >= 0
              ? "text-slate-900 dark:text-white"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {formatCurrency(income - expense)}
        </p>
      </div>
      {transfers !== 0 && (
        <div>
          <p className="text-xs text-slate-400">Transferências (grupos/ativos)</p>
          <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(transfers)}
          </p>
        </div>
      )}
    </Card>
  )
}
