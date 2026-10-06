import { useState } from "react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useAccounts } from "../../hooks/useAccounts"
import { useCategories } from "../../hooks/useCategories"
import { usePlaylists } from "../../hooks/usePlaylists"
import { todayISO } from "../../lib/format"
import type { Transaction, TransactionType } from "../../types"
import type { TransactionInput } from "../../api/transactions"

export function TransactionForm({
  initial,
  lockedPlaylistId,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Transaction
  lockedPlaylistId?: number
  onSubmit: (data: TransactionInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [amount, setAmount] = useState(String(initial?.amount ?? ""))
  const [accountId, setAccountId] = useState(initial?.account_id ?? 0)
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? null)
  const [playlistId, setPlaylistId] = useState<number | null>(
    lockedPlaylistId ?? initial?.playlist_id ?? null
  )
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [notes, setNotes] = useState(initial?.notes ?? "")

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories(type)
  const { data: playlists } = usePlaylists()

  // Dentro de um ativo, "Despesa/Receita" não descreve o que acontece: numa
  // obra a saída é aporte e aumenta a posição; numa moto é gasto e não mexe no
  // valor. Os botões passam a dizer o efeito real.
  const posicao = lockedPlaylistId
    ? playlists?.find((p) => p.id === lockedPlaylistId)
    : undefined
  const capital = posicao?.kind === "asset" && posicao.value_mode === "capital"
  const declarado = posicao?.kind === "asset" && posicao.value_mode === "declarado"

  const rotulo = (t: TransactionType) => {
    if (capital) return t === "expense" ? "Aportar" : "Receber de volta"
    if (declarado) return t === "expense" ? "Gasto" : "Receita"
    return t === "expense" ? "Despesa" : "Receita"
  }

  const explicacao = capital
    ? type === "expense"
      ? `Sai da conta e vira valor em ${posicao?.name}: a posição aumenta e não conta como gasto do mês.`
      : `Volta de ${posicao?.name} para a conta: a posição diminui e não conta como receita do mês.`
    : declarado
      ? type === "expense"
        ? `Sai da conta como gasto de verdade. O valor de ${posicao?.name} não muda — para mudar, edite o ativo.`
        : `Entra na conta como receita de verdade. O valor de ${posicao?.name} não muda.`
      : null

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
          date,
          notes: notes || null,
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
            {rotulo(t)}
          </button>
        ))}
      </div>
      {explicacao && <p className="-mt-2 text-xs text-slate-400">{explicacao}</p>}

      <div>
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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

      {!lockedPlaylistId && (
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
      )}

      <div>
        <Label>Notas (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !accountId}>
          {initial ? "Salvar" : "Adicionar"}
        </Button>
      </div>
    </form>
  )
}
