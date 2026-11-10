import { useState } from "react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { Toggle } from "../ui/Toggle"
import { useAccounts } from "../../hooks/useAccounts"
import { formatCurrency, todayISO } from "../../lib/format"
import type { DebtInput } from "../../api/playlists"

type Direction = DebtInput["direction"]

/** Paguei / a dívida aumentou. Por padrão só a dívida muda; ligando "Mexer no Caixa" a conta paga (ou recebe). */
export function DebtForm({
  owed,
  onSubmit,
  onCancel,
  submitting,
}: {
  /** Quanto falta pagar, positivo. */
  owed: number
  onSubmit: (data: DebtInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [direction, setDirection] = useState<Direction>(owed > 0 ? "pay" : "increase")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState("")
  const [withCash, setWithCash] = useState(false)
  const [accountId, setAccountId] = useState(0)
  const { data: accounts } = useAccounts()
  const account = accountId || (accounts?.length === 1 ? accounts[0].id : 0)
  const paying = direction === "pay"
  const value = Number(amount) || 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          direction,
          amount: value,
          date,
          account_id: withCash ? account : null,
          description: description || undefined,
        })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
        {(["pay", "increase"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={clsx(
              "rounded-lg py-2 text-sm font-medium transition-colors",
              direction === d
                ? d === "pay"
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {d === "pay" ? "Paguei" : "A dívida aumentou"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="debt-amount">{paying ? "Quanto foi pago" : "Quanto aumentou"}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              R$
            </span>
            <Input
              id="debt-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={paying ? owed : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              className="pl-9 text-lg! font-semibold"
              required
            />
          </div>
          {paying && (
            <button
              type="button"
              onClick={() => setAmount(String(owed))}
              className="mt-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Falta {formatCurrency(owed)} · pagar tudo
            </button>
          )}
        </div>
        <div>
          <Label htmlFor="debt-date">Data</Label>
          <Input id="debt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <Toggle
        checked={withCash}
        onChange={setWithCash}
        label={paying ? "Mexer no Caixa: o pagamento saiu de uma conta" : "Mexer no Caixa: o dinheiro entrou numa conta"}
        hint={
          withCash
            ? paying
              ? "A conta escolhida diminui e a dívida também. Não conta como gasto do mês."
              : "Pegou mais emprestado: a conta escolhida aumenta junto com a dívida."
            : "Desligado, só a dívida muda: contas e Caixa ficam como estão (pago por fora, juros que caíram...)."
        }
      />

      {withCash && (
        <div>
          <Label htmlFor="debt-account">Conta</Label>
          <Select id="debt-account" value={account} onChange={(e) => setAccountId(Number(e.target.value))} required>
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
      )}

      <div>
        <Label htmlFor="debt-description">Descrição (opcional)</Label>
        <Input
          id="debt-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={paying ? "Pagamento da dívida" : "Aumento da dívida"}
        />
      </div>

      {value > 0 && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
          A dívida vai de {formatCurrency(-owed)} para {formatCurrency(-owed + (paying ? value : -value))}
          {withCash ? "." : ", sem mexer no Caixa."}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || value <= 0 || (withCash && !account)}>
          Lançar
        </Button>
      </div>
    </form>
  )
}
