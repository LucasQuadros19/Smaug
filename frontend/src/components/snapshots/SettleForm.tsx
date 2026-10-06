import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { formatCurrency, todayISO } from "../../lib/format"
import type { Account, Playlist } from "../../types"
import type { SettleInput } from "../../api/snapshots"

export function SettleForm({
  positions,
  accounts,
  onSubmit,
  onCancel,
  submitting,
}: {
  positions: Playlist[]
  accounts: Account[]
  onSubmit: (data: SettleInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  // Posições derivadas (empréstimo) se quitam na tela de origem.
  const sellable = positions.filter((p) => !p.auto_source && (p.opening_value ?? 0) > 0)

  const [playlistId, setPlaylistId] = useState(sellable[0]?.id ?? 0)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0)
  const [received, setReceived] = useState("")
  const [partial, setPartial] = useState("")
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState("")

  const position = sellable.find((p) => p.id === playlistId)
  const bookValue = position?.opening_value ?? 0
  const reduceBy = partial === "" ? bookValue : Number(partial) || 0
  const gain = (Number(received) || 0) - reduceBy

  if (sellable.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Não há posição com valor para liquidar. Empréstimos se quitam na tela de Empréstimos.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          from: { type: "playlist", id: playlistId },
          to_account_id: accountId,
          received: Number(received),
          reduce_by: partial === "" ? null : Number(partial),
          date,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <p className="text-xs text-slate-400">
        Vendeu a obra, resgatou o investimento? A posição baixa e o dinheiro entra na conta. Os
        dois valores podem ser diferentes — a diferença é lucro (ou prejuízo) realizado.
      </p>

      <div>
        <Label>O que saiu</Label>
        <Select value={playlistId} onChange={(e) => setPlaylistId(Number(e.target.value))}>
          {sellable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name} — {formatCurrency(p.opening_value ?? 0)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quanto recebi</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label>Entrou em qual conta</Label>
        <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Baixa parcial (opcional)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={partial}
          onChange={(e) => setPartial(e.target.value)}
          placeholder={`Vazio = baixa tudo (${formatCurrency(bookValue)})`}
        />
      </div>

      <div>
        <Label>Observação (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: venda da obra"
        />
      </div>

      <div className="flex flex-wrap gap-6 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[0.03]">
        <div>
          <p className="text-xs text-slate-400">Sai da posição</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {formatCurrency(reduceBy)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">{gain >= 0 ? "Lucro realizado" : "Prejuízo"}</p>
          <p
            className={`font-semibold ${
              gain >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatCurrency(gain)}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !accountId || Number(received) <= 0}>
          Confirmar
        </Button>
      </div>
    </form>
  )
}
