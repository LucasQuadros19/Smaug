import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { formatCurrency, formatDate } from "../../lib/format"
import { getAmountColorClass } from "../../lib/transactionDisplay"
import type { Transaction } from "../../types"

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Últimas transações
        </h3>
        <Link
          to="/transacoes"
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Ver todas
        </Link>
      </div>
      {transactions.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nenhuma transação registrada ainda
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{
                    backgroundColor: `${tx.playlist?.color ?? tx.category?.color ?? "#6366f1"}20`,
                  }}
                >
                  {tx.playlist?.icon ?? tx.category?.icon ?? "💰"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {tx.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(tx.date)} · {tx.account_name}
                    {tx.playlist && (
                      <>
                        {" "}
                        · <span className="text-indigo-500 dark:text-indigo-400">transferência</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${getAmountColorClass(tx)}`}>
                {tx.type === "income" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
