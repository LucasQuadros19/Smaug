import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { LoanCard } from "../components/loans/LoanCard"
import { LoanTable } from "../components/loans/LoanTable"
import { matchesFilter, type LoanFilter } from "../lib/loanFilters"
import { Input } from "../components/ui/Input"
import { LoanForm } from "../components/loans/LoanForm"
import { PostponeForm } from "../components/loans/PostponeForm"
import { RepaymentForm, type RepaymentMode } from "../components/loans/RepaymentForm"
import { useLoans, useLoanMutations } from "../hooks/useLoans"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { formatCurrency } from "../lib/format"
import { useConfirm } from "../components/ui/ConfirmDialog"
import type { Loan } from "../types"
import type { LoanInput } from "../api/loans"

export function Loans() {
  const { data: loans, isLoading } = useLoans()
  const { create, update, remove, addRepayment, settlePartners, removeRepayment, postpone, undoEvent } =
    useLoanMutations()
  const ask = useConfirm()
  const [modal, setModal] = useState<"form" | "repayment" | "postpone" | null>(null)
  const [postponing, setPostponing] = useState<Loan | undefined>()
  const [editing, setEditing] = useState<Loan | undefined>()
  const [settling, setSettling] = useState<{ loan: Loan; mode: RepaymentMode } | undefined>()
  const [filter, setFilter] = useState<LoanFilter>("open")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<number | null>(null)
  const { submit, error, reset } = useFormSubmit(() => setModal(null))

  const open = (loan?: Loan) => {
    setEditing(loan)
    reset()
    setModal("form")
  }

  const openRepayment = (loan: Loan, mode: RepaymentMode) => {
    setSettling({ loan, mode })
    reset()
    setModal("repayment")
  }

  const handleRemoveRepayment = (loanId: number, repaymentId: number) =>
    ask({
      title: "Desfazer recebimento?",
      message: "Esse recebimento sai do empréstimo.",
      consequences: ["Os lançamentos que ele gerou nas contas somem junto.", "Se o empréstimo estava quitado, volta a ficar em aberto."],
      confirmLabel: "Desfazer",
      action: () => removeRepayment.mutateAsync({ id: loanId, repaymentId }),
      done: "Recebimento desfeito",
    })

  const handleSubmit = (data: LoanInput) =>
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))

  const handleDelete = (loan: Loan) => {
    const received = loan.repayments.reduce((sum, r) => sum + r.amount, 0)
    const entries = loan.repayments.length + (loan.outflow ? 1 : 0)
    if (entries === 0) {
      return ask({
        title: "Excluir empréstimo?",
        message: `O empréstimo para ${loan.borrower} (${formatCurrency(loan.amount)}) será apagado.`,
        consequences: ["O caixa não muda: este empréstimo não fez nenhum lançamento.", "Some do calendário, do patrimônio e dos cálculos."],
        action: () => remove.mutateAsync({ id: loan.id, keepCash: true }),
        done: "Empréstimo excluído",
      })
    }
    const moves = [
      received > 0 ? `${formatCurrency(received)} recebidos` : null,
      loan.outflow ? `saída de ${formatCurrency(loan.outflow.amount)}` : null,
    ]
      .filter(Boolean)
      .join(" e ")
    ask({
      title: "Excluir empréstimo?",
      message: `O empréstimo para ${loan.borrower} (${formatCurrency(loan.amount)}) tem ${entries} lançamento(s) no caixa: ${moves}.`,
      choices: [
        {
          value: "keep",
          label: "Apagar só o empréstimo — o caixa não muda",
          hint: "Os lançamentos continuam nas contas como lançamentos comuns. O saldo fica exatamente como está.",
        },
        {
          value: "undo",
          label: "Apagar e desfazer no caixa também",
          hint: `${received > 0 ? `${formatCurrency(received)} saem das contas` : ""}${received > 0 && loan.outflow ? " e " : ""}${
            loan.outflow ? `${formatCurrency(loan.outflow.amount)} voltam para a conta de onde saíram` : ""
          }. Use só se o empréstimo foi registrado por engano.`,
          typeToConfirm: loan.borrower,
        },
      ],
      action: (choice) => remove.mutateAsync({ id: loan.id, keepCash: choice !== "undo" }),
      done: (choice) => (choice === "undo" ? "Empréstimo excluído e lançamentos desfeitos no caixa" : "Empréstimo excluído — o caixa não mudou"),
    })
  }

  const cardActions = (loan: Loan) => ({
    onEdit: () => open(loan),
    onDelete: () => handleDelete(loan),
    onReceive: (mode: RepaymentMode) => openRepayment(loan, mode),
    onSettlePartners: (repaymentId: number) => {
      const part = loan.repayments.find((r) => r.id === repaymentId)
      ask({
        title: "Registrar repasse aos sócios?",
        message: `${formatCurrency(part?.partners_share ?? 0)} saem da conta para os sócios.`,
        consequences: ["Vira um lançamento de saída na mesma conta do recebimento."],
        confirmLabel: "Registrar repasse",
        tone: "default",
        action: () => settlePartners.mutateAsync({ id: loan.id, repaymentId }),
        done: "Repasse registrado",
      })
    },
    onRemoveRepayment: (repaymentId: number) => handleRemoveRepayment(loan.id, repaymentId),
    onPostpone: () => {
      setPostponing(loan)
      reset()
      setModal("postpone")
    },
    onUndo: (eventId: number) => {
      const event = loan.events.find((e) => e.id === eventId)
      ask({
        title: event?.kind === "postpone" ? "Desfazer adiamento?" : "Desfazer recebimento?",
        message: "O último passo deste empréstimo será desfeito.",
        consequences: [
          ...(event?.kind === "receipt" ? [`Os ${formatCurrency(event.total)} recebidos saem do caixa.`] : []),
          "Vencimento, meses e situação voltam ao que eram antes.",
        ],
        confirmLabel: "Desfazer",
        action: () => undoEvent.mutateAsync({ id: loan.id, eventId }),
        done: "Passo desfeito",
      })
    },
  })

  const active = loans?.filter((l) => l.status !== "paid") ?? []
  const term = search.trim().toLowerCase()
  const shown = (loans ?? []).filter((l) => matchesFilter(l, filter) && (!term || l.borrower.toLowerCase().includes(term)))

  const totalOut = active.reduce((sum, l) => sum + l.amount, 0)
  const myOut = active.reduce((sum, l) => sum + (l.my_contributed ?? 0), 0)
  const myMonthly = active.reduce((sum, l) => sum + l.my_monthly, 0)

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
              <p className="text-xs text-slate-400">Eu ganho por mês</p>
              <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
                {formatCurrency(myMonthly)}
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
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Filtrar empréstimos" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
                {(
                  [
                    ["open", "Em aberto"],
                    ["late", "Atrasados"],
                    ["paid", "Quitados"],
                    ["all", "Todos"],
                  ] as [LoanFilter, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
                      (filter === value
                        ? "bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")
                    }
                  >
                    {label} <span className="text-slate-400">{loans.filter((l) => matchesFilter(l, value)).length}</span>
                  </button>
                ))}
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome..."
                aria-label="Buscar por nome"
                className="max-w-xs"
              />
            </div>
            {shown.length === 0 ? (
              <Card>
                <p className="py-6 text-center text-sm text-slate-400">Nenhum empréstimo neste filtro.</p>
              </Card>
            ) : (
              <LoanTable
                loans={shown}
                expanded={expanded}
                onToggle={(id) => setExpanded(expanded === id ? null : id)}
                onReceive={(loan) => openRepayment(loan, "full")}
                renderDetail={(loan) => <LoanCard loan={loan} {...cardActions(loan)} />}
              />
            )}
          </section>
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
        title={`${settling?.mode === "interest" ? "Recebi só os juros" : "Recebi"} · ${settling?.loan.borrower ?? ""}`}
        error={error}
      >
        {settling && (
          <RepaymentForm
            key={`${settling.loan.id}-${settling.mode}`}
            loan={settling.loan}
            mode={settling.mode}
            onSubmit={(data) => submit(addRepayment.mutateAsync({ id: settling.loan.id, data }))}
            onCancel={() => setModal(null)}
            submitting={addRepayment.isPending}
          />
        )}
      </Modal>
      <Modal
        open={modal === "postpone"}
        onClose={() => setModal(null)}
        title={`Adiar · ${postponing?.borrower ?? ""}`}
        error={error}
      >
        {postponing && (
          <PostponeForm
            key={postponing.id}
            loan={postponing}
            onSubmit={(data) => submit(postpone.mutateAsync({ id: postponing.id, data }))}
            onCancel={() => setModal(null)}
            submitting={postpone.isPending}
          />
        )}
      </Modal>
    </>
  )
}
