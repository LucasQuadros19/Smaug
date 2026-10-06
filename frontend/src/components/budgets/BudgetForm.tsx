import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useCategories } from "../../hooks/useCategories"
import type { BudgetInput } from "../../api/budgets"

export function BudgetForm({
  month,
  onSubmit,
  onCancel,
  submitting,
}: {
  month: string
  onSubmit: (data: BudgetInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: categories } = useCategories("expense")
  const [categoryId, setCategoryId] = useState(0)
  const [limitAmount, setLimitAmount] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ category_id: categoryId, month, limit_amount: Number(limitAmount) })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Categoria</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} required>
          <option value={0} disabled>
            Selecione
          </option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Limite mensal</Label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={limitAmount}
          onChange={(e) => setLimitAmount(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !categoryId}>
          Criar orçamento
        </Button>
      </div>
    </form>
  )
}
