import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Modal } from "../components/ui/Modal"
import { TransactionForm } from "../components/transactions/TransactionForm"
import { TransactionFilters } from "../components/transactions/TransactionFilters"
import { TransactionTable } from "../components/transactions/TransactionTable"
import { TransactionsSummary } from "../components/transactions/TransactionsSummary"
import { CategoryBreakdownPanel } from "../components/transactions/CategoryBreakdownPanel"
import { Pagination } from "../components/ui/Pagination"
import { WealthOverview } from "../components/dashboard/WealthOverview"
import { useTransactions, useTransactionMutations } from "../hooks/useTransactions"
import { useDashboardSummary } from "../hooks/useDashboard"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { currentMonth } from "../lib/format"
import type { Transaction } from "../types"
import type { TransactionFilters as Filters, TransactionInput } from "../api/transactions"

export function Transactions() {
  const [filters, setFilters] = useState<Filters>({})
  const [page, setPage] = useState(1)
  const { data: result, isLoading } = useTransactions({ ...filters, page, per_page: 50 })
  const { data: dashboard } = useDashboardSummary(currentMonth())

  // Trocar o filtro invalida a página atual — sempre volta para a primeira.
  const changeFilters = (next: Filters) => {
    setFilters(next)
    setPage(1)
  }

  const transactions = result?.items ?? []
  const { create, update, remove } = useTransactionMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: TransactionInput) => {
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))
  }

  const handleDelete = (tx: Transaction) => {
    if (confirm(`Excluir a transação "${tx.description}"?`)) {
      remove.mutate(tx.id)
    }
  }

  return (
    <>
      <Topbar
        title="Transações"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Nova transação
          </Button>
        }
      />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {dashboard && <WealthOverview summary={dashboard} />}

        <TransactionFilters filters={filters} onChange={changeFilters} />

        {isLoading && !result ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <>
            <TransactionsSummary transactions={transactions} totals={result?.totals} />

            {result && result.by_category.length > 0 && (
              <CategoryBreakdownPanel
                items={result.by_category}
                selectedId={filters.category_id}
                onSelect={(id) => changeFilters({ ...filters, category_id: id })}
              />
            )}
            <TransactionTable
              transactions={transactions}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
            {result && (
              <Pagination
                page={result.page}
                pages={result.pages}
                total={result.total}
                perPage={result.per_page}
                onChange={setPage}
                label="transações"
              />
            )}
          </>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar transação" : "Nova transação"}
        error={error}
      >
        <TransactionForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </>
  )
}
