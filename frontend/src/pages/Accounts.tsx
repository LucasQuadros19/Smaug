import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Modal } from "../components/ui/Modal"
import { AccountForm } from "../components/accounts/AccountForm"
import { AccountCard } from "../components/accounts/AccountCard"
import { useAccounts, useAccountMutations } from "../hooks/useAccounts"
import { useFormSubmit } from "../hooks/useFormSubmit"
import type { Account } from "../types"
import type { AccountInput } from "../api/accounts"

export function Accounts() {
  const { data: accounts, isLoading } = useAccounts()
  const { create, update, remove } = useAccountMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (account: Account) => {
    setEditing(account)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: AccountInput) => {
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))
  }

  const handleDelete = (account: Account) => {
    if (confirm(`Excluir a conta "${account.name}"? Todas as transações associadas também serão excluídas.`)) {
      remove.mutate(account.id)
    }
  }

  return (
    <>
      <Topbar
        title="Contas"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Nova conta
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : accounts && accounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={() => openEdit(account)}
                onDelete={() => handleDelete(account)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhuma conta cadastrada ainda.</p>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar conta" : "Nova conta"}
        error={error}
      >
        <AccountForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </>
  )
}
