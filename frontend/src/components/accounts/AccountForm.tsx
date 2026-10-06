import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { ColorPicker } from "../ui/ColorPicker"
import { ACCOUNT_TYPE_LABELS } from "../../lib/constants"
import type { Account, AccountType } from "../../types"
import type { AccountInput } from "../../api/accounts"

export function AccountForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Account
  onSubmit: (data: AccountInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [type, setType] = useState<AccountType>(initial?.type ?? "checking")
  const [initialBalance, setInitialBalance] = useState(String(initial?.initial_balance ?? 0))
  const [color, setColor] = useState(initial?.color ?? "#6366f1")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ name, type, initial_balance: Number(initialBalance), color })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank" required />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Saldo inicial</Label>
        <Input
          type="number"
          step="0.01"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
          required
        />
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
          {initial ? "Salvar" : "Criar conta"}
        </Button>
      </div>
    </form>
  )
}
