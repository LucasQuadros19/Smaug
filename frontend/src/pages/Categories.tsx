import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { CategoryForm } from "../components/categories/CategoryForm"
import { CategoryRow } from "../components/categories/CategoryRow"
import { useCategories, useCategoryMutations } from "../hooks/useCategories"
import { useFormSubmit } from "../hooks/useFormSubmit"
import type { Category } from "../types"
import type { CategoryInput } from "../api/categories"

export function Categories() {
  const { data: categories, isLoading } = useCategories()
  const { create, update, remove } = useCategoryMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (category: Category) => {
    setEditing(category)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: CategoryInput) => {
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))
  }

  const handleDelete = (category: Category) => {
    if (confirm(`Excluir a categoria "${category.name}"?`)) {
      remove.mutate(category.id)
    }
  }

  const income = categories?.filter((c) => c.type === "income") ?? []
  const expense = categories?.filter((c) => c.type === "expense") ?? []

  return (
    <>
      <Topbar
        title="Categorias"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Nova categoria
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Receitas</h3>
              <div className="space-y-2">
                {income.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma categoria de receita.</p>
                )}
                {income.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onEdit={() => openEdit(category)}
                    onDelete={() => handleDelete(category)}
                  />
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Despesas</h3>
              <div className="space-y-2">
                {expense.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma categoria de despesa.</p>
                )}
                {expense.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onEdit={() => openEdit(category)}
                    onDelete={() => handleDelete(category)}
                  />
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar categoria" : "Nova categoria"}
        error={error}
      >
        <CategoryForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </>
  )
}
