import { Fragment, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { formatCurrency, formatDate, todayISO } from "../../lib/format"
import { isLate } from "../../lib/loanFilters"
import type { Loan } from "../../types"

function daysLate(loan: Loan) {
  return loan.due_date ? Math.round((Date.parse(todayISO()) - Date.parse(loan.due_date)) / 86_400_000) : 0
}

function Status({ loan }: { loan: Loan }) {
  const [label, style] =
    loan.status === "paid"
      ? ["Quitado", "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"]
      : isLate(loan)
        ? ["Atrasado", "bg-rose-500/10 text-rose-600 dark:text-rose-400"]
        : ["Em aberto", "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"]
  return <span className={clsx("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", style)}>{label}</span>
}

/** Os empréstimos em linhas; clicar abre os detalhes e as ações logo abaixo. */
export function LoanTable({
  loans,
  expanded,
  onToggle,
  onReceive,
  renderDetail,
}: {
  loans: Loan[]
  expanded: number | null
  onToggle: (id: number) => void
  onReceive: (loan: Loan) => void
  renderDetail: (loan: Loan) => ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-white/5">
            <th className="w-8 px-3 py-3" />
            <th className="px-3 py-3 font-medium">Para quem</th>
            <th className="px-3 py-3 text-right font-medium">Emprestado</th>
            <th className="px-3 py-3 text-right font-medium">Juros/mês</th>
            <th className="px-3 py-3 font-medium">Próximo vencimento</th>
            <th className="px-3 py-3 text-right font-medium">A receber</th>
            <th className="px-3 py-3 text-right font-medium">Já voltou</th>
            <th className="px-3 py-3 font-medium">Situação</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {loans.map((loan) => {
            const open = expanded === loan.id
            const late = isLate(loan) ? daysLate(loan) : 0
            const next = loan.next_payment.interest + loan.next_payment.principal
            return (
              <Fragment key={loan.id}>
                <tr
                  onClick={() => onToggle(loan.id)}
                  className={clsx("cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]", open && "bg-slate-50 dark:bg-white/[0.03]")}
                >
                  <td className="px-3 py-3">
                    <ChevronRight size={16} className={clsx("text-slate-400 transition-transform", open && "rotate-90")} />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{loan.borrower}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(loan.start_date)} ·{" "}
                      {loan.status === "paid" ? `${loan.months} ${loan.months === 1 ? "mês" : "meses"}` : `mês ${loan.next_payment.month} de ${loan.months}`} ·{" "}
                      {loan.schedule === "installments" ? "parcelas" : "só juros"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{formatCurrency(loan.amount)}</p>
                    {loan.my_contributed != null && loan.my_contributed !== loan.amount && (
                      <p className="text-xs text-slate-400">meu {formatCurrency(loan.my_contributed)}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className="text-slate-700 dark:text-slate-200">{formatCurrency(loan.monthly_interest)}</p>
                    {loan.my_monthly > 0 && loan.my_monthly !== loan.monthly_interest && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">eu {formatCurrency(loan.my_monthly)}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {loan.status === "paid" || !loan.due_date ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <>
                        <p className={clsx(late ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200")}>
                          {formatDate(loan.due_date)}
                        </p>
                        {late > 0 && <p className="text-xs text-rose-500">há {late} {late === 1 ? "dia" : "dias"}</p>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {loan.status === "paid" ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{formatCurrency(next)}</p>
                        {loan.interest_pending > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">{formatCurrency(loan.interest_pending)} em atraso</p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(loan.total_repaid)}</td>
                  <td className="px-3 py-3">
                    <Status loan={loan} />
                  </td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {loan.status !== "paid" && (
                      <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onReceive(loan)}>
                        Recebi
                      </Button>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={9} className="bg-slate-50/60 p-3 dark:bg-white/[0.02]">
                      {renderDetail(loan)}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
