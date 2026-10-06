import { useState } from "react"
import { Plus, ShoppingCart } from "lucide-react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { ShoppingItemForm } from "./ShoppingItemForm"
import { ShoppingItemRow } from "./ShoppingItemRow"
import { useShoppingItems, useShoppingItemMutations } from "../../hooks/useShoppingItems"
import { useFormSubmit } from "../../hooks/useFormSubmit"
import { formatCurrency } from "../../lib/format"
import type { ShoppingItem } from "../../types"
import type { ShoppingItemInput } from "../../api/shoppingItems"

export function ShoppingListSection({
  playlistId,
  title = "Lista de compras",
}: {
  playlistId?: number
  title?: string
}) {
  const { data: items, isLoading } = useShoppingItems(playlistId)
  const { create, update, remove } = useShoppingItemMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShoppingItem | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (item: ShoppingItem) => {
    setEditing(item)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: Omit<ShoppingItemInput, "playlist_id">) => {
    submit(
      editing
        ? update.mutateAsync({ id: editing.id, data })
        : create.mutateAsync({ ...data, playlist_id: playlistId ?? null })
    )
  }

  const handleDelete = (item: ShoppingItem) => {
    if (window.confirm(`Excluir "${item.description}" da lista?`)) {
      remove.mutate(item.id)
    }
  }

  const pending = (items ?? []).filter((i) => !i.purchased)
  const purchased = (items ?? []).filter((i) => i.purchased)
  const pendingTotal = pending.reduce((sum, i) => sum + (i.amount ?? 0), 0)
  const purchasedTotal = purchased.reduce((sum, i) => sum + (i.amount ?? 0), 0)

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Nova compra
        </Button>
      </div>

      {(pendingTotal > 0 || purchasedTotal > 0) && (
        <div className="mb-4 flex flex-wrap gap-6 border-b border-slate-100 pb-4 dark:border-white/5">
          <div>
            <p className="text-xs text-slate-400">Falta comprar ({pending.length})</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(pendingTotal)}
            </p>
          </div>
          {purchased.length > 0 && (
            <div>
              <p className="text-xs text-slate-400">Já comprado ({purchased.length})</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(purchasedTotal)}
              </p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nada na lista ainda. Anote aqui o que você precisa comprar, com prioridade e valor
          estimado — é só uma nota, não vira transação.
        </p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onTogglePurchased={() =>
                    update.mutate({ id: item.id, data: { purchased: true } })
                  }
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
          {purchased.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
              <p className="text-xs font-medium text-slate-400">Já comprado</p>
              {purchased.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onTogglePurchased={() =>
                    update.mutate({ id: item.id, data: { purchased: false } })
                  }
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar compra" : "Nova compra"}
        error={error}
      >
        <ShoppingItemForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </Card>
  )
}
