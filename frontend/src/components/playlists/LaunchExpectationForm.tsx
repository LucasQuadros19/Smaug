import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useAccounts } from "../../hooks/useAccounts"
import { todayISO } from "../../lib/format"
import type { PlaylistExpectation } from "../../types"
import type { LaunchExpectationInput } from "../../api/expectations"

export function LaunchExpectationForm({
  expectation,
  onSubmit,
  onCancel,
  submitting,
}: {
  expectation: PlaylistExpectation
  onSubmit: (data: LaunchExpectationInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [accountId, setAccountId] = useState(expectation.account_id ?? 0)
  const [amount, setAmount] = useState(String(expectation.amount))
  const [date, setDate] = useState(todayISO())

  const { data: accounts } = useAccounts()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ account_id: accountId, amount: Number(amount), date })
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Lançar <strong>{expectation.description}</strong> cria essa entrada de verdade no caixa
        agora. Ela continua aqui, então você pode lançar de novo no futuro (ex: próxima parcela).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor recebido</Label>
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
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>Conta</Label>
        <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} required>
          <option value={0} disabled>
            Selecione
          </option>
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
        <Button type="submit" disabled={submitting || !accountId}>
          Lançar
        </Button>
      </div>
    </form>
  )
}
