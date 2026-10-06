import { useState } from "react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label } from "../ui/Input"
import { PRIORITY_LABELS, PRIORITY_STYLES } from "../../lib/shopping"
import type { ShoppingItem, ShoppingPriority } from "../../types"
import type { ShoppingItemInput } from "../../api/shoppingItems"

export function ShoppingItemForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: ShoppingItem
  onSubmit: (data: Omit<ShoppingItemInput, "playlist_id">) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [description, setDescription] = useState(initial?.description ?? "")
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "")
  const [priority, setPriority] = useState<ShoppingPriority>(initial?.priority ?? "medium")
  const [notes, setNotes] = useState(initial?.notes ?? "")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          description,
          amount: amount ? Number(amount) : null,
          priority,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <div>
        <Label>O que você precisa comprar</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Fone de ouvido, capacete novo..."
          required
        />
      </div>

      <div>
        <Label>Prioridade</Label>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={clsx(
                "rounded-lg py-2 text-sm font-medium transition-colors",
                priority === p
                  ? PRIORITY_STYLES[p].active
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Valor estimado (opcional)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
        />
      </div>

      <div>
        <Label>Notas (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Onde comprar, modelo, link..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {initial ? "Salvar" : "Adicionar"}
        </Button>
      </div>
    </form>
  )
}
