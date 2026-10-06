import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useAccounts } from "../../hooks/useAccounts"
import type { ExpectationInput } from "../../api/expectations"

export function ExpectationForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (data: Omit<ExpectationInput, "playlist_id">) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [accountId, setAccountId] = useState<number | null>(null)

  const { data: accounts } = useAccounts()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          description,
          amount: Number(amount),
          expected_date: expectedDate,
          account_id: accountId,
        })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Descrição</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: 1ª parcela, cheque de setembro..."
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor esperado</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Data esperada</Label>
          <Input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label>Conta sugerida (opcional)</Label>
        <Select
          value={accountId ?? ""}
          onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Escolher na hora de confirmar</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          Adicionar
        </Button>
      </div>
    </form>
  )
}
