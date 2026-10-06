import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { formatCurrency, todayISO } from "../../lib/format"
import type { Account, Playlist } from "../../types"
import type { InvestInput } from "../../api/snapshots"

export function InvestForm({
  positions,
  accounts,
  onSubmit,
  onCancel,
  submitting,
}: {
  positions: Playlist[]
  accounts: Account[]
  onSubmit: (data: InvestInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  // Posições derivadas se alimentam pela tela de origem.
  const targets = positions.filter((p) => !p.auto_source)

  const [playlistId, setPlaylistId] = useState(targets[0]?.id ?? 0)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState("")

  const target = targets.find((p) => p.id === playlistId)
  const account = accounts.find((a) => a.id === accountId)
  const value = Number(amount) || 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          to: { type: "playlist", id: playlistId },
          from_account_id: accountId,
          amount: value,
          date,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <p className="text-xs text-slate-400">
        Colocou mais dinheiro na obra, no investimento? Sai da conta e entra na posição. O
        patrimônio total não muda — só deixa de estar disponível.
      </p>

      <div>
        <Label>Onde entra</Label>
        <Select value={playlistId} onChange={(e) => setPlaylistId(Number(e.target.value))}>
          {targets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name} — {formatCurrency(p.opening_value ?? 0)}
            </option>
          ))}
        </Select>
        {target && value > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            fica {formatCurrency((target.opening_value ?? 0) + value)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor</Label>
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
        <Label>Sai de qual conta</Label>
        <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {formatCurrency(a.balance ?? 0)}
            </option>
          ))}
        </Select>
        {account && value > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            fica {formatCurrency((account.balance ?? 0) - value)}
          </p>
        )}
      </div>

      <div>
        <Label>Observação (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: mais material para a obra"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !playlistId || !accountId || value <= 0}>
          Aportar
        </Button>
      </div>
    </form>
  )
}
