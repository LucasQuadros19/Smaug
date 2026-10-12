import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { SegmentedControl } from "../ui/SegmentedControl"
import { BusinessDayHint } from "../ui/BusinessDayHint"
import { useAccounts } from "../../hooks/useAccounts"
import { addMonths, formatCurrency, todayISO } from "../../lib/format"
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
  type Then = "next" | "close" | "partial"
  const [then, setThen] = useState<Then>("next")
  const [nextDate, setNextDate] = useState(addMonths(expectation.expected_date, 1))

  const { data: accounts } = useAccounts()
  const received = Number(amount) || 0
  const partial = received > 0 && received < expectation.amount
  // Chegou menos que o esperado: o natural é o resto continuar esperado.
  const mode: Then = partial && then === "next" ? "partial" : then

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          account_id: accountId,
          amount: received,
          date,
          then: mode,
          next_date: mode === "close" ? null : nextDate || null,
        })
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Lançar <strong>{expectation.description}</strong> cria essa entrada de verdade no caixa agora.
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
      <div className="space-y-2">
        <Label>Depois de lançar</Label>
        <SegmentedControl<Then>
          ariaLabel="Depois de lançar"
          value={mode}
          onChange={setThen}
          options={[
            partial
              ? { value: "partial", label: "O resto ainda vem" }
              : { value: "next", label: "Espero de novo" },
            { value: "close", label: "Encerrar" },
          ]}
        />
        {mode !== "close" && (
          <div>
            <Label>{mode === "partial" ? `Os ${formatCurrency(expectation.amount - received)} que faltam vêm em` : "Próxima vez"}</Label>
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required={mode === "next"} />
            <BusinessDayHint date={nextDate} onPick={setNextDate} />
          </div>
        )}
        <p className="text-xs text-slate-400">
          {mode === "close"
            ? "Sai da lista de esperados — não aparece mais como atrasado nem no calendário."
            : mode === "partial"
              ? "O que faltar continua esperado, na data acima."
              : "Continua aqui com a nova data (ex: a mesma parcela todo mês)."}
        </p>
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
