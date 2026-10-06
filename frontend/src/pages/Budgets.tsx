import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { MonthSwitcher } from "../components/ui/MonthSwitcher"
import { BudgetBar } from "../components/budgets/BudgetBar"
import { BudgetForm } from "../components/budgets/BudgetForm"
import { useBudgets, useBudgetMutations } from "../hooks/useBudgets"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { currentMonth } from "../lib/format"
import type { BudgetInput } from "../api/budgets"

export function Budgets() {
  const [month, setMonth] = useState(currentMonth())
  const { data: budgets, isLoading } = useBudgets(month)
  const { create, remove } = useBudgetMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const handleSubmit = (data: BudgetInput) => {
    submit(create.mutateAsync(data))
  }

  const handleDelete = (id: number, name?: string) => {
    if (confirm(`Excluir o orçamento de "${name}"?`)) {
      remove.mutate(id)
    }
  }

  return (
    <>
      <Topbar
        title="Orçamentos"
        action={
          <div className="flex items-center gap-3">
            <MonthSwitcher month={month} onChange={setMonth} />
            <Button
              onClick={() => {
                reset()
                setModalOpen(true)
              }}
            >
              <Plus size={16} /> Novo orçamento
            </Button>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : !budgets || budgets.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhum orçamento definido para este mês.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {budgets.map((budget) => (
              <Card key={budget.id}>
                <div className="mb-3 flex items-center justify-end">
                  <button
                    onClick={() => handleDelete(budget.id, budget.category?.name)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <BudgetBar budget={budget} />
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo orçamento" error={error}>
        <BudgetForm
          month={month}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending}
        />
      </Modal>
    </>
  )
}
