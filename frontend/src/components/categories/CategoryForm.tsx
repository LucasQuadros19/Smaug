import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { ColorPicker } from "../ui/ColorPicker"
import { IconPicker } from "../ui/IconPicker"
import type { Category, CategoryType } from "../../types"
import type { CategoryInput } from "../../api/categories"

export function CategoryForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Category
  onSubmit: (data: CategoryInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [type, setType] = useState<CategoryType>(initial?.type ?? "expense")
  const [color, setColor] = useState(initial?.color ?? "#6366f1")
  const [icon, setIcon] = useState(initial?.icon ?? "💰")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ name, type, color, icon })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alimentação" required />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </Select>
      </div>
      <div>
        <Label>Ícone</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div>
        <Label>Cor</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {initial ? "Salvar" : "Criar categoria"}
        </Button>
      </div>
    </form>
  )
}
