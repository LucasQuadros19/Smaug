import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label } from "../ui/Input"
import { Toggle } from "../ui/Toggle"
import { BusinessDayHint } from "../ui/BusinessDayHint"
import { useSettings } from "../../hooks/useMe"
import { addMonths, formatCurrency, formatDate, isoDate, todayISO } from "../../lib/format"
import type { Loan } from "../../types"
import type { PostponeInput } from "../../api/loans"

/** Adia o vencimento sem receber nada; com ou sem os juros do mês. */
export function PostponeForm({
  loan,
  onSubmit,
  onCancel,
  submitting,
}: {
  loan: Loan
  onSubmit: (data: PostponeInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const base = loan.due_date ?? todayISO()
  const [dueDate, setDueDate] = useState(addMonths(base, 1))
  const { settings } = useSettings()
  const [charge, setCharge] = useState(settings.postpone_charges)
  const [notes, setNotes] = useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ due_date: dueDate, charge_interest: charge, notes: notes || null })
      }}
      className="space-y-4"
    >
      {loan.due_date && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vence em <span className="font-medium text-slate-800 dark:text-slate-100">{formatDate(loan.due_date)}</span>.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[7, 15, 30].map((days) => {
          const [y, m, d] = base.split("-").map(Number)
          const iso = isoDate(new Date(y, m - 1, d + days))
          return (
            <Button key={days} type="button" variant="secondary" onClick={() => setDueDate(iso)}>
              +{days} dias
            </Button>
          )
        })}
        <Button type="button" variant="secondary" onClick={() => setDueDate(addMonths(base, 1))}>
          +1 mês
        </Button>
      </div>
      <div>
        <Label>Novo vencimento</Label>
        <Input type="date" value={dueDate} min={loan.due_date ?? undefined} onChange={(e) => setDueDate(e.target.value)} required />
        <BusinessDayHint date={dueDate} onPick={setDueDate} />
      </div>
      <Toggle
        checked={charge}
        onChange={setCharge}
        label="Cobrar os juros deste mês"
        hint={
          charge
            ? `O mês vence mesmo sem pagar: ${formatCurrency(loan.monthly_interest)} ficam em atraso e entram no próximo recebimento.`
            : "Carência: só muda a data, sem juros a mais."
        }
      />
      <div>
        <Label>Observação (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: pediu mais prazo" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          Adiar
        </Button>
      </div>
    </form>
  )
}
