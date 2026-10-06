import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label } from "../ui/Input"
import type { PlaylistExpectation } from "../../types"

export function RenewExpectationForm({
  expectation,
  onSubmit,
  onCancel,
  submitting,
}: {
  expectation: PlaylistExpectation
  onSubmit: (data: { expected_date: string; amount: number }) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [expectedDate, setExpectedDate] = useState("")
  const [amount, setAmount] = useState(String(expectation.amount))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ expected_date: expectedDate, amount: Number(amount) })
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Renovar <strong>{expectation.description}</strong> só empurra a data — nada é lançado no
        caixa agora.
      </p>
      <div>
        <Label>Nova data esperada</Label>
        <Input
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          required
        />
      </div>
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
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          Renovar
        </Button>
      </div>
    </form>
  )
}
