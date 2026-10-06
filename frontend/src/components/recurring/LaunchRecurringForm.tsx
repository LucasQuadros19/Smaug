import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label } from "../ui/Input"
import { formatCurrency, formatDate } from "../../lib/format"
import { FREQUENCY_LABELS } from "../../lib/constants"
import type { RecurringTransaction } from "../../types"
import type { LaunchRecurringInput } from "../../api/recurring"

export function LaunchRecurringForm({
  item,
  onSubmit,
  onCancel,
  submitting,
}: {
  item: RecurringTransaction
  onSubmit: (data: LaunchRecurringInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  // Vem preenchido com o valor cadastrado, mas o ponto do modo manual é
  // justamente poder trocar: a conta de luz nunca vem igual.
  const [amount, setAmount] = useState(String(item.amount))
  const [date, setDate] = useState(item.due_date)

  const valor = Number(amount)
  const diferenca = valor - item.amount
  const entrada = item.type === "income"

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ amount: valor, date })
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Lançar <strong>{item.description}</strong> em{" "}
        <strong>{item.account_name}</strong> com o valor deste período. Depois disso o próximo
        vencimento anda para o {FREQUENCY_LABELS[item.frequency].toLowerCase()} seguinte.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{entrada ? "Valor recebido" : "Valor pago"}</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      {/* Comparar com o previsto é metade da razão de existir o modo manual. */}
      {Number.isFinite(valor) && valor > 0 && Math.abs(diferenca) >= 0.01 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Previsto {formatCurrency(item.amount)} ·{" "}
          <span
            className={
              diferenca > 0
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "font-medium text-emerald-600 dark:text-emerald-400"
            }
          >
            {diferenca > 0 ? "+" : "−"}
            {formatCurrency(Math.abs(diferenca))} {diferenca > 0 ? "acima" : "abaixo"}
          </span>
        </p>
      )}

      <p className="text-xs text-slate-400">
        Vencimento atual: {formatDate(item.due_date)}
      </p>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !(valor > 0)}>
          Lançar {valor > 0 ? formatCurrency(valor) : ""}
        </Button>
      </div>
    </form>
  )
}
