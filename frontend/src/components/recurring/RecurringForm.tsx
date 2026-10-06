import { useState } from "react"
import clsx from "clsx"
import { Bot, Hand } from "lucide-react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useAccounts } from "../../hooks/useAccounts"
import { useCategories } from "../../hooks/useCategories"
import { usePlaylists } from "../../hooks/usePlaylists"
import { FREQUENCY_LABELS } from "../../lib/constants"
import { todayISO } from "../../lib/format"
import type { RecurringFrequency, RecurringTransaction, TransactionType } from "../../types"
import type { RecurringInput } from "../../api/recurring"

export function RecurringForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: RecurringTransaction
  onSubmit: (data: RecurringInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [amount, setAmount] = useState(String(initial?.amount ?? ""))
  const [accountId, setAccountId] = useState(initial?.account_id ?? 0)
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? null)
  const [playlistId, setPlaylistId] = useState<number | null>(initial?.playlist_id ?? null)
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? "monthly")
  const [nextDueDate, setNextDueDate] = useState(initial?.next_due_date ?? todayISO())
  const [auto, setAuto] = useState(initial?.auto ?? true)

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories(type)
  const { data: playlists } = usePlaylists()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          description,
          amount: Number(amount),
          type,
          account_id: accountId,
          category_id: categoryId,
          playlist_id: playlistId,
          frequency,
          next_due_date: nextDueDate,
          auto,
        })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t)
              setCategoryId(null)
            }}
            className={clsx(
              "rounded-lg py-2 text-sm font-medium transition-colors",
              type === t
                ? t === "expense"
                  ? "bg-rose-500 text-white"
                  : "bg-emerald-500 text-white"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {t === "expense" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>

      <div>
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Netflix" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label>Frequência</Label>
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <Label>Categoria</Label>
          <Select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Sem categoria</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Grupo ou ativo (opcional)</Label>
        <Select
          value={playlistId ?? ""}
          onChange={(e) => setPlaylistId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Nenhuma</option>
          {playlists?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Próximo vencimento</Label>
        <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} required />
      </div>

      <div>
        <Label>Como lançar</Label>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {([true, false] as const).map((modo) => (
            <button
              key={String(modo)}
              type="button"
              onClick={() => setAuto(modo)}
              className={clsx(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
                auto === modo
                  ? modo
                    ? "bg-[#2a78d6] text-white"
                    : "bg-amber-500 text-white"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              {modo ? <Bot size={15} /> : <Hand size={15} />}
              {modo ? "Automático" : "Manual"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {auto
            ? "Lança sozinha no vencimento, sempre com o valor acima."
            : "Fica esperando você lançar, e aí você informa o valor real do período."}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !accountId}>
          {initial ? "Salvar" : "Criar recorrência"}
        </Button>
      </div>
    </form>
  )
}
