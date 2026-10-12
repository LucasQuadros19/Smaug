import { CalendarClock, CalendarDays, Pencil, Printer, Trash2, Undo2, User } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { formatCurrency, formatDate, todayISO } from "../../lib/format"
import { printLoanReceipt } from "../../lib/receipt"
import { LoanBars } from "./LoanBars"
import type { RepaymentMode } from "./RepaymentForm"
import type { Loan, LoanRepayment, LoanStatus } from "../../types"

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
  onReceive,
  onSettlePartners,
  onRemoveRepayment,
  onPostpone,
  onUndo,
}: {
  loan: Loan
  onEdit: () => void
  onDelete: () => void
  onReceive: (mode: RepaymentMode) => void
  onSettlePartners: (repaymentId: number) => void
  onRemoveRepayment: (repaymentId: number) => void
  onPostpone: () => void
  onUndo: (eventId: number) => void
}) {
  const status = STATUS[loan.status]
  const legacy = loan.repayments.filter((r) => r.event_id === null)
  const daysLate = loan.status !== "paid" && loan.due_date && loan.due_date < todayISO() ? daysBetween(loan.due_date, todayISO()) : 0

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
            {daysLate > 0 && loan.status !== "late" && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                atrasado há {daysLate} {daysLate === 1 ? "dia" : "dias"}
              </span>
            )}
            {loan.interest_pending > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {formatCurrency(loan.interest_pending)} de juros em atraso
              </span>
            )}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <CalendarDays size={12} /> {formatDate(loan.start_date)}
            </span>
            {loan.due_date && loan.status !== "paid" && <span>vence {formatDate(loan.due_date)}</span>}
            {loan.outflow && <span>saiu {formatCurrency(loan.outflow.amount)} da conta</span>}
            {loan.interest_rate != null && (
              <span className="font-medium text-slate-500 dark:text-slate-300">
                {loan.interest_rate}% ao mês
              </span>
            )}
            <span>
              {loan.status === "paid" ? `${loan.months} ${loan.months === 1 ? "mês" : "meses"}` : `mês ${loan.next_payment.month} de ${loan.months}`}
              {" · "}
              {loan.schedule === "installments" ? "parcelas" : "só juros"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
        {loan.monthly_interest > 0 && (
          <div>
            <p className="text-xs text-slate-400">Juros por mês</p>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(loan.monthly_interest)}
            </p>
          </div>
        )}
        {loan.commission > 0 && (
          <div>
            <p className="text-xs text-slate-400">Comissão por mês</p>
            <p className="text-lg font-medium text-[#7a6f96] dark:text-[#b3a9cf]">
              {formatCurrency(loan.commission)}
            </p>
          </div>
        )}
        {loan.my_to_receive != null && loan.my_monthly > 0 && (
          <div>
            <p className="text-xs text-slate-400">Eu ganho por mês</p>
            <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(loan.my_monthly)}
            </p>
          </div>
        )}
        {loan.months > 1 && loan.profit > 0 && (
          <div>
            <p className="text-xs text-slate-400">Lucro em {loan.months} meses</p>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">{formatCurrency(loan.profit)}</p>
          </div>
        )}
      </div>

      {loan.status !== "paid" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => onReceive("interest")} className="py-1.5 text-xs" disabled={loan.monthly_interest <= 0}>
            Recebi só os juros
          </Button>
          <Button variant="secondary" onClick={onPostpone} className="py-1.5 text-xs">
            <CalendarClock size={14} /> Adiar
          </Button>
          <Button onClick={() => onReceive("full")} className="py-1.5 text-xs">
            {loan.schedule === "installments" && loan.next_payment.month < loan.months ? "Recebi a parcela" : "Recebi"}
          </Button>
          <span className="text-xs text-slate-400">
            Próximo: {formatCurrency(loan.next_payment.interest + loan.next_payment.principal)}
            {loan.next_payment.principal > 0 && loan.next_payment.interest > 0 && " (principal + juros)"}
          </span>
        </div>
      )}

      <LoanBars people={loan.participants} />

      {(loan.events.length > 0 || legacy.length > 0) && (
        <div className="border-t border-slate-100 pt-3 dark:border-white/5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Histórico</p>
            <p className="text-xs text-slate-400">
              {formatCurrency(loan.my_repaid)} de {formatCurrency(loan.my_principal)} meu já voltou
            </p>
          </div>

          {/* Progresso do que já retornou do meu principal. */}
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${loan.my_principal > 0 ? Math.min(100, (loan.my_repaid / loan.my_principal) * 100) : 0}%` }}
            />
          </div>

          <ul className="space-y-2">
            {[...loan.events].reverse().map((event, index) => (
              <li key={event.id} className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">{formatDate(event.date)}</span>
                    {event.kind === "postpone" ? (
                      <span>
                        Adiado {event.due_after && `para ${formatDate(event.due_after)}`}
                        <span className="text-slate-400"> · {event.charged ? "juros do mês em atraso" : "carência"}</span>
                      </span>
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-100">Recebi {formatCurrency(event.total)}</span>
                    )}
                    {event.kind === "receipt" && event.due_after && (
                      <span className="text-slate-400">· vence {formatDate(event.due_after)}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                  {event.kind === "receipt" && (
                    <button
                      onClick={() => printLoanReceipt(loan, event)}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="Recibo para imprimir ou salvar em PDF"
                    >
                      <Printer size={12} /> recibo
                    </button>
                  )}
                  {index === 0 && (
                    <button
                      onClick={() => onUndo(event.id)}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-slate-400 hover:text-rose-500"
                      title="Desfazer este passo"
                    >
                      <Undo2 size={12} /> desfazer
                    </button>
                  )}
                  </span>
                </div>
                {event.parts.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {event.parts.map((part) => (
                      <li key={part.id}>
                        <PartRow part={part} onSettlePartners={onSettlePartners} />
                      </li>
                    ))}
                  </ul>
                )}
                {event.notes && <p className="mt-1 text-slate-400">{event.notes}</p>}
              </li>
            ))}
            {legacy.map((repayment) => (
              <li key={repayment.id} className="flex items-center justify-between gap-2 px-2.5 text-xs">
                <span className="text-slate-400">{formatDate(repayment.date)}</span>
                <span className="flex items-center gap-2">
                  <PartRow part={repayment} onSettlePartners={onSettlePartners} />
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

const KIND_LABEL: Record<LoanRepayment["kind"], { label: string; className: string }> = {
  principal: { label: "principal", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  interest: { label: "juros", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  fee: { label: "multa", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/** Uma parte de um recebimento: o tipo, o valor e o repasse aos sócios. */
function PartRow({ part, onSettlePartners }: { part: LoanRepayment; onSettlePartners: (id: number) => void }) {
  const kind = KIND_LABEL[part.kind]
  return (
    <span className="flex items-center justify-end gap-2">
      <span className={clsx("rounded-full px-1.5 py-px text-[10px] font-medium", kind.className)}>{kind.label}</span>
      <span className="text-slate-700 dark:text-slate-200">{formatCurrency(part.amount)}</span>
      {part.partners_share > 0 &&
        (part.partners_settled ? (
          <span className="text-slate-400">{formatCurrency(part.partners_share)} repassado</span>
        ) : (
          <button
            onClick={() => onSettlePartners(part.id)}
            className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
          >
            repassar {formatCurrency(part.partners_share)}
          </button>
        ))}
    </span>
  )
}
