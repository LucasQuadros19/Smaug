import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label } from "../ui/Input"
import { formatCurrency, formatRate, todayISO } from "../../lib/format"
import type { Account, Playlist } from "../../types"
import type { SnapshotInput } from "../../api/snapshots"

export function SnapshotForm({
  positions,
  accounts,
  onSubmit,
  onCancel,
  submitting,
}: {
  positions: Playlist[]
  accounts: Account[]
  onSubmit: (data: SnapshotInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [date, setDate] = useState(todayISO())
  const [inflow, setInflow] = useState("")
  const [notes, setNotes] = useState("")
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    // Na moeda de cada posição (US$ para quem acompanha em dólar). Posição
    // automática mostra o valor que vem da origem (Empréstimos).
    for (const p of positions)
      initial[`p${p.id}`] = String(p.auto_source ? p.opening_value : p.native_value)
    for (const a of accounts) initial[`a${a.id}`] = String(a.balance ?? 0)
    return initial
  })

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const inBrl = (p: Playlist) => (Number(values[`p${p.id}`]) || 0) * (p.rate ?? 0)
  const invested = positions.reduce((sum, p) => sum + inBrl(p), 0)
  const cash = accounts.reduce((sum, a) => sum + (Number(values[`a${a.id}`]) || 0), 0)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          date,
          inflow: Number(inflow) || 0,
          notes: notes || null,
          entries: [
            ...positions.map((p) => ({
              playlist_id: p.id,
              value: Number(values[`p${p.id}`]) || 0,
            })),
            ...accounts.map((a) => ({
              account_id: a.id,
              value: Number(values[`a${a.id}`]) || 0,
            })),
          ],
        })
      }}
      className="space-y-4"
    >
      <p className="text-xs text-slate-400">
        Os valores vêm preenchidos com o estado atual. Ajuste o que mudou e salve — vira uma
        linha nova no histórico e atualiza o patrimônio.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Entrada (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            value={inflow}
            onChange={(e) => setInflow(e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-100 p-3 dark:border-white/5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Posições</p>
        <div className="grid grid-cols-2 gap-3">
          {positions.map((position) => (
            <div key={position.id}>
              <Label>
                {position.icon} {position.name}
                {position.currency !== "BRL" && ` (${position.currency})`}
              </Label>
              <Input
                type="number"
                step={position.currency === "BTC" ? "0.00000001" : "0.01"}
                value={values[`p${position.id}`] ?? ""}
                onChange={(e) => setValue(`p${position.id}`, e.target.value)}
                readOnly={Boolean(position.auto_source)}
                className={position.auto_source ? "cursor-not-allowed opacity-60" : undefined}
              />
              {position.auto_source === "loans" && (
                <p className="mt-1 text-[11px] text-slate-400">vem da tela de Empréstimos</p>
              )}
              {position.currency !== "BRL" && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {position.rate
                    ? `≈ ${formatCurrency(inBrl(position))} · 1 ${position.currency} = ${formatRate(position.rate)}`
                    : "sem cotação no momento"}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-100 p-3 dark:border-white/5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Dinheiro disponível
        </p>
        <div className="grid grid-cols-2 gap-3">
          {accounts.map((account) => (
            <div key={account.id}>
              <Label>{account.name}</Label>
              <Input
                type="number"
                step="0.01"
                value={values[`a${account.id}`] ?? ""}
                onChange={(e) => setValue(`a${account.id}`, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Observação (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: ajustes de preço, bitcoin a 69k..."
        />
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[0.03]">
        <div>
          <p className="text-xs text-slate-400">Investido</p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {formatCurrency(invested)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Disponível</p>
          <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(cash)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Patrimônio</p>
          <p className="font-semibold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(invested + cash)}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          Salvar registro
        </Button>
      </div>
    </form>
  )
}
