import { Pencil, Trash2 } from "lucide-react"
import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import { ACCOUNT_TYPE_LABELS } from "../../lib/constants"
import type { Account } from "../../types"

export function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: Account
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: account.color }}
          >
            {account.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{account.name}</p>
            <p className="text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[account.type]}</p>
          </div>
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
      <p className="text-2xl font-semibold text-slate-900 dark:text-white">
        {formatCurrency(account.balance)}
      </p>
    </Card>
  )
}
