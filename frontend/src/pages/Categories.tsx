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
import { useConfirm } from "../components/ui/ConfirmDialog"

export function Categories() {
  const { data: categories, isLoading } = useCategories()
  const { create, update, remove, reorder } = useCategoryMutations()
  const [dragging, setDragging] = useState<number | null>(null)
  const ask = useConfirm()
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

  const handleDelete = (category: Category) =>
    ask({
      title: "Excluir categoria?",
      message: (
        <>
          A categoria <strong>{category.name}</strong> será apagada.
        </>
      ),
      consequences: ["Os lançamentos dela continuam, só ficam sem categoria.", "Os orçamentos dessa categoria são apagados."],
      action: () => remove.mutateAsync(category.id),
      done: "Categoria excluída",
    })

  const income = categories?.filter((c) => c.type === "income") ?? []
  const expense = categories?.filter((c) => c.type === "expense") ?? []

  const move = (list: Category[], id: number, to: number) => {
    const ids = list.map((c) => c.id).filter((other) => other !== id)
    ids.splice(to, 0, id)
    reorder.mutate(ids)
  }

  const rows = (list: Category[]) =>
    list.map((category, i) => (
      <CategoryRow
        key={category.id}
        category={category}
        onEdit={() => openEdit(category)}
        onDelete={() => handleDelete(category)}
        onMoveUp={i > 0 ? () => move(list, category.id, i - 1) : undefined}
        onMoveDown={i < list.length - 1 ? () => move(list, category.id, i + 1) : undefined}
        onDragStart={() => setDragging(category.id)}
        onDrop={() => {
          if (dragging !== null && dragging !== category.id && list.some((c) => c.id === dragging)) {
            move(list, dragging, i)
          }
          setDragging(null)
        }}
        dragging={dragging === category.id}
      />
    ))

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
            <p className="text-xs text-slate-400 lg:col-span-2">
              Arraste ou use as setas para mudar a ordem: as de cima aparecem primeiro ao lançar no Caixa.
            </p>
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Receitas</h3>
              <div className="space-y-2">
                {income.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma categoria de receita.</p>
                )}
                {rows(income)}
              </div>
            </Card>
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Despesas</h3>
              <div className="space-y-2">
                {expense.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma categoria de despesa.</p>
                )}
                {rows(expense)}
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
