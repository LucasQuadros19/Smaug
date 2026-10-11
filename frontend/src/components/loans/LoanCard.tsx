import { CalendarDays, Pencil, Trash2, User } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { formatCurrency, formatDate } from "../../lib/format"
import { LoanBars } from "./LoanBars"
import type { Loan, LoanStatus } from "../../types"

const STATUS: Record<LoanStatus, { label: string; className: string }> = {
  active: {
    label: "Em aberto",
    className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  paid: {
    label: "Quitado",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  late: {
    label: "Atrasado",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
}

export function LoanCard({
  loan,
  onEdit,
  onDelete,
  onSettle,
  onSettlePartners,
  onRemoveRepayment,
}: {
  loan: Loan
  onEdit: () => void
  onDelete: () => void
  onSettle: () => void
  onSettlePartners: (repaymentId: number) => void
  onRemoveRepayment: (repaymentId: number) => void
}) {
  const status = STATUS[loan.status]

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <User size={16} />
            </span>
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
              {loan.borrower}
            </p>
            <span
              className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <CalendarDays size={12} /> {formatDate(loan.start_date)}
            </span>
            {loan.due_date && <span>até {formatDate(loan.due_date)}</span>}
            {loan.interest_rate != null && (
              <span className="font-medium text-slate-500 dark:text-slate-300">
                {loan.interest_rate}%
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loan.status !== "paid" && (
            <Button variant="secondary" onClick={onSettle} className="mr-1 py-1.5 text-xs">
              {loan.repayments.length > 0 ? "Recebi mais" : "Recebi de volta"}
            </Button>
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
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-slate-400">Valor emprestado</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {formatCurrency(loan.amount)}
          </p>
        </div>
        {loan.my_contributed != null && (
          <div>
            <p className="text-xs text-slate-400">Da minha parte</p>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(loan.my_contributed)}
            </p>
          </div>
        )}
        {loan.profit > 0 && (
          <div>
            <p className="text-xs text-slate-400">Lucro</p>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(loan.profit)}
            </p>
          </div>
        )}
        {loan.commission > 0 && (
          <div>
            <p className="text-xs text-slate-400">Comissão</p>
            <p className="text-lg font-medium text-[#7a6f96] dark:text-[#b3a9cf]">
              {formatCurrency(loan.commission)}
            </p>
          </div>
        )}
        {loan.my_to_receive != null && (
          <div>
            <p className="text-xs text-slate-400">Eu recebo</p>
            <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(loan.my_to_receive)}
            </p>
          </div>
        )}
      </div>

      <LoanBars people={loan.participants} />

      {loan.repayments.length > 0 && (
        <div className="border-t border-slate-100 pt-3 dark:border-white/5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Já voltou ({loan.repayments.length})
            </p>
            <p className="text-xs text-slate-400">
              {formatCurrency(loan.my_repaid)} de {formatCurrency(loan.my_principal)} meu
            </p>
          </div>

          {/* Progresso do que já retornou do meu principal. */}
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${
                  loan.my_principal > 0
                    ? Math.min(100, (loan.my_repaid / loan.my_principal) * 100)
                    : 0
                }%`,
              }}
            />
          </div>

          <ul className="space-y-1.5">
            {loan.repayments.map((repayment) => (
              <li key={repayment.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {formatDate(repayment.date)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-200">
                    {formatCurrency(repayment.amount)}
                  </span>
                  {repayment.partners_share > 0 &&
                    (repayment.partners_settled ? (
                      <span className="text-slate-400">
                        {formatCurrency(repayment.partners_share)} repassado
                      </span>
                    ) : (
                      <button
                        onClick={() => onSettlePartners(repayment.id)}
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                      >
                        repassar {formatCurrency(repayment.partners_share)}
                      </button>
                    ))}
                  <button
                    onClick={() => onRemoveRepayment(repayment.id)}
                    className="rounded p-0.5 text-slate-300 hover:text-rose-500 dark:text-slate-600"
                    aria-label="Desfazer recebimento"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loan.pending_to_partners > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {formatCurrency(loan.pending_to_partners)} de sócios está no seu caixa esperando
          repasse — já está fora do seu patrimônio.
        </p>
      )}

      {loan.notes && (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-white/5">
          {loan.notes}
        </p>
      )}
    </Card>
  )
}
