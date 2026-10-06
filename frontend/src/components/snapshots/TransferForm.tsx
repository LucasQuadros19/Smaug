import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { formatCurrency, todayISO } from "../../lib/format"
import type { Account, Playlist, TransferRef } from "../../types"
import type { TransferInput } from "../../api/snapshots"

/** "playlist:19" -> {type:"playlist", id:19} */
function parseRef(raw: string): TransferRef {
  const [type, id] = raw.split(":")
  return { type: type as TransferRef["type"], id: Number(id) }
}

export function TransferForm({
  positions,
  accounts,
  onSubmit,
  onCancel,
  submitting,
}: {
  positions: Playlist[]
  accounts: Account[]
  onSubmit: (data: TransferInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const options = [
    // Posições derivadas (ex: empréstimo) não entram: o valor delas vem da
    // tela de origem, então mover à mão seria sobrescrito na hora.
    ...positions
      .filter((p) => !p.auto_source)
      .map((p) => ({
        key: `playlist:${p.id}`,
        label: `${p.icon} ${p.name}`,
        value: p.opening_value ?? 0,
      })),
    ...accounts.map((a) => ({
      key: `account:${a.id}`,
      label: `💵 ${a.name}`,
      value: a.balance ?? 0,
    })),
  ]

  const [from, setFrom] = useState(options[0]?.key ?? "")
  const [to, setTo] = useState(options[1]?.key ?? "")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState("")

  const origin = options.find((o) => o.key === from)
  const target = options.find((o) => o.key === to)
  const value = Number(amount) || 0
  const sameSide = from === to

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          from: parseRef(from),
          to: parseRef(to),
          amount: value,
          date,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <p className="text-xs text-slate-400">
        Tira de um lugar e põe em outro em um passo só — como receber da obra e emprestar no
        mesmo dia. O patrimônio total não muda, só onde o dinheiro está.
        {positions.some((p) => p.auto_source) && (
          <>
            {" "}
            Posições que puxam valor de outra tela (como Empréstimos) não aparecem aqui — registre
            lá que o patrimônio acompanha.
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div>
          <Label>De onde sai</Label>
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
          {origin && (
            <p className="mt-1 text-xs text-slate-400">
              tem {formatCurrency(origin.value)}
              {value > 0 && (
                <>
                  {" "}
                  → fica{" "}
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatCurrency(origin.value - value)}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="hidden pb-7 text-slate-400 sm:block">
          <ArrowRight size={18} />
        </div>

        <div>
          <Label>Para onde vai</Label>
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
          {target && (
            <p className="mt-1 text-xs text-slate-400">
              tem {formatCurrency(target.value)}
              {value > 0 && (
                <>
                  {" "}
                  → fica{" "}
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatCurrency(target.value + value)}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
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
        <Label>Observação (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: recebi da obra e emprestei"
        />
      </div>

      {sameSide && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          Origem e destino precisam ser diferentes.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || sameSide || value <= 0}>
          Transferir
        </Button>
      </div>
    </form>
  )
}
