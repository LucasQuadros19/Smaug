import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { LoanCard } from "../components/loans/LoanCard"
import { LoanForm } from "../components/loans/LoanForm"
import { RepaymentForm } from "../components/loans/RepaymentForm"
import { useLoans, useLoanMutations } from "../hooks/useLoans"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { formatCurrency } from "../lib/format"
import type { Loan } from "../types"
import type { LoanInput } from "../api/loans"

export function Loans() {
  const { data: loans, isLoading } = useLoans()
  const { create, update, remove, addRepayment, settlePartners, removeRepayment } =
    useLoanMutations()
  const [modal, setModal] = useState<"form" | "repayment" | null>(null)
  const [editing, setEditing] = useState<Loan | undefined>()
  const [settling, setSettling] = useState<Loan | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModal(null))

  const open = (loan?: Loan) => {
    setEditing(loan)
    reset()
    setModal("form")
  }

  const openRepayment = (loan: Loan) => {
    setSettling(loan)
    reset()
    setModal("repayment")
  }

  const handleRemoveRepayment = (loanId: number, repaymentId: number) => {
    if (confirm("Desfazer esse recebimento? Os lançamentos gerados também somem.")) {
      removeRepayment.mutate({ id: loanId, repaymentId })
    }
  }

  const handleSubmit = (data: LoanInput) =>
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))

  const handleDelete = (loan: Loan) => {
    if (confirm(`Excluir o empréstimo para "${loan.borrower}"?`)) remove.mutate(loan.id)
  }

  const active = loans?.filter((l) => l.status !== "paid") ?? []
  const paid = loans?.filter((l) => l.status === "paid") ?? []

  const totalOut = active.reduce((sum, l) => sum + l.amount, 0)
  const myOut = active.reduce((sum, l) => sum + (l.my_contributed ?? 0), 0)
  const myReturn = active.reduce((sum, l) => sum + (l.my_to_receive ?? 0), 0)

  return (
    <>
      <Topbar
        title="Empréstimos"
        action={
          <Button onClick={() => open()}>
            <Plus size={16} /> Novo empréstimo
          </Button>
        }
      />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {active.length > 0 && (
          <Card className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-slate-400">Emprestado em aberto</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {formatCurrency(totalOut)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Da minha parte</p>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                {formatCurrency(myOut)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Eu recebo</p>
              <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
                {formatCurrency(myReturn)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Empréstimos ativos</p>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                {active.length}
              </p>
            </div>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : !loans || loans.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhum empréstimo registrado. Anote para quem emprestou, quando, a porcentagem e
              quem entrou com dinheiro junto com você.
            </p>
          </Card>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Em aberto
                </h2>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {active.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      onEdit={() => open(loan)}
                      onDelete={() => handleDelete(loan)}
                      onSettle={() => openRepayment(loan)}
                      onSettlePartners={(rid) =>
                        settlePartners.mutate({ id: loan.id, repaymentId: rid })
                      }
                      onRemoveRepayment={(rid) => handleRemoveRepayment(loan.id, rid)}
                    />
                  ))}
                </div>
              </section>
            )}
            {paid.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Quitados
                </h2>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {paid.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      onEdit={() => open(loan)}
                      onDelete={() => handleDelete(loan)}
                      onSettle={() => openRepayment(loan)}
                      onSettlePartners={(rid) =>
                        settlePartners.mutate({ id: loan.id, repaymentId: rid })
                      }
                      onRemoveRepayment={(rid) => handleRemoveRepayment(loan.id, rid)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <Modal
        open={modal === "form"}
        onClose={() => setModal(null)}
        title={editing ? "Editar empréstimo" : "Novo empréstimo"}
        error={error}
      >
        <LoanForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>

      <Modal
        open={modal === "repayment"}
        onClose={() => setModal(null)}
        title="Recebi de volta"
        error={error}
      >
        {settling && (
          <RepaymentForm
            loan={settling}
            onSubmit={(data) => submit(addRepayment.mutateAsync({ id: settling.id, data }))}
            onCancel={() => setModal(null)}
            submitting={addRepayment.isPending}
          />
        )}
      </Modal>
    </>
  )
}
