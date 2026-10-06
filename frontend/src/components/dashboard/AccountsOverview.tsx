import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import type { AccountBalance } from "../../types"

export function AccountsOverview({ accounts }: { accounts: AccountBalance[] }) {
  if (accounts.length === 0) return null

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Saldo por conta
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-white/5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: account.color }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-600 dark:text-slate-300">{account.name}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(account.balance)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
