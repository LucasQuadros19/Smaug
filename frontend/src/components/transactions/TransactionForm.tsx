import { useState } from "react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useAccounts } from "../../hooks/useAccounts"
import { useCategories } from "../../hooks/useCategories"
import { usePlaylists } from "../../hooks/usePlaylists"
import { isoDate, todayISO } from "../../lib/format"
import type { Transaction, TransactionType } from "../../types"
import type { TransactionInput } from "../../api/transactions"

const LAST_ACCOUNT = "smaug:ultima-conta"
// As primeiras da ordem escolhida em Categorias; o resto abre em "outras".
const SHOWN_CATEGORIES = 8

function lastAccount() {
  try {
    return Number(localStorage.getItem(LAST_ACCOUNT)) || 0
  } catch {
    return 0
  }
}

function yesterdayISO() {
  const day = new Date()
  day.setDate(day.getDate() - 1)
  return isoDate(day)
}

const chip = "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
const idleChip =
  "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"

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
  const [accountId, setAccountId] = useState(initial ? (initial.account_id ?? 0) : lastAccount())
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? null)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [playlistId, setPlaylistId] = useState<number | null>(
    lockedPlaylistId ?? initial?.playlist_id ?? null
  )
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [notes, setNotes] = useState(initial?.notes ?? "")

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories(type)
  const { data: playlists } = usePlaylists()

  // Novo lançamento já vem na última conta usada (ou na única que existe).
  // Editando, fica a do lançamento — inclusive "sem conta" da saída forçada da planilha.
  const account = initial
    ? accountId
    : accounts?.some((a) => a.id === accountId)
      ? accountId
      : accounts?.length === 1
        ? accounts[0].id
        : 0

  const categoryList = categories ?? []
  const selectedIndex = categoryList.findIndex((c) => c.id === categoryId)
  const shownCategories =
    showAllCategories || selectedIndex >= SHOWN_CATEGORIES ? categoryList : categoryList.slice(0, SHOWN_CATEGORIES)

  // Dentro de um ativo, "Despesa/Receita" não descreve o que acontece: numa
  // obra a saída é aporte e aumenta a posição; numa moto é gasto e não mexe no
  // valor. Os botões passam a dizer o efeito real.
  const posicao = lockedPlaylistId
    ? playlists?.find((p) => p.id === lockedPlaylistId)
    : undefined
  const divida = posicao?.kind === "asset" && posicao.asset_type === "debt"
  const capital = posicao?.kind === "asset" && posicao.value_mode === "capital"
  const declarado = posicao?.kind === "asset" && posicao.value_mode === "declarado"

  const rotulo = (t: TransactionType) => {
    if (divida) return t === "expense" ? "Paguei" : "Peguei mais"
    if (capital) return t === "expense" ? "Aportar" : "Receber de volta"
    if (declarado) return t === "expense" ? "Gasto" : "Receita"
    return t === "expense" ? "Despesa" : "Receita"
  }

  const explicacao = divida
    ? type === "expense"
      ? `Sai da conta e ${posicao?.name} diminui. Não conta como gasto do mês. Para pagar sem mexer no Caixa, use "Pagamento / aumento".`
      : `Entra na conta e ${posicao?.name} aumenta. Não conta como receita do mês.`
    : capital
    ? type === "expense"
      ? `Sai da conta e vira valor em ${posicao?.name}: a posição aumenta e não conta como gasto do mês.`
      : `Volta de ${posicao?.name} para a conta: a posição diminui e não conta como receita do mês.`
    : declarado
      ? type === "expense"
        ? `Sai da conta como gasto de verdade. O valor de ${posicao?.name} não muda — para mudar, edite o ativo.`
        : `Entra na conta como receita de verdade. O valor de ${posicao?.name} não muda.`
      : null

  const quickDates = [
    { label: "Hoje", value: todayISO() },
    { label: "Ontem", value: yesterdayISO() },
  ]

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!initial && account) {
          try {
            localStorage.setItem(LAST_ACCOUNT, String(account))
          } catch {
            // Sem armazenamento (aba anônima): só não lembra a conta da próxima vez.
          }
        }
        onSubmit({
          description,
          amount: Number(amount),
          type,
          // 0 = sem conta: só a saída forçada da planilha, que continua assim.
          account_id: account || null,
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
              setShowAllCategories(false)
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tx-amount">Valor</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              R$
            </span>
            <Input
              id="tx-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus={!initial}
              className="pl-9 text-lg! font-semibold"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="tx-date">Data</Label>
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <div className="mt-1.5 flex gap-1">
            {quickDates.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => setDate(quick.value)}
                aria-pressed={date === quick.value}
                className={clsx(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  date === quick.value
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                )}
              >
                {quick.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="tx-description">Descrição</Label>
        <Input
          id="tx-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "expense" ? "Ex.: Mercado da semana" : "Ex.: Salário"}
          required
        />
      </div>

      <div>
        <Label>Categoria</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoria">
          {shownCategories.map((c) => {
            const selected = c.id === categoryId
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategoryId(selected ? null : c.id)}
                className={clsx(chip, selected ? "font-semibold text-slate-900 dark:text-white" : idleChip)}
                style={
                  selected
                    ? { borderColor: c.color, backgroundColor: `${c.color}33`, boxShadow: `inset 0 0 0 1px ${c.color}` }
                    : undefined
                }
              >
                {c.icon} {c.name}
              </button>
            )
          })}
          {shownCategories.length < categoryList.length && (
            <button type="button" onClick={() => setShowAllCategories(true)} className={clsx(chip, idleChip, "border-dashed")}>
              + {categoryList.length - shownCategories.length} outras
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          {categoryId === null ? "Sem categoria" : "Clique de novo para tirar"} · a ordem se escolhe em Categorias
        </p>
      </div>

      <div className={clsx("grid gap-3", lockedPlaylistId ? "grid-cols-1" : "grid-cols-2")}>
        <div>
          <Label htmlFor="tx-account">Conta</Label>
          <Select id="tx-account" value={account} onChange={(e) => setAccountId(Number(e.target.value))} required>
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
        {!lockedPlaylistId && (
          <div>
            <Label htmlFor="tx-playlist">Grupo ou ativo</Label>
            <Select
              id="tx-playlist"
              value={playlistId ?? ""}
              onChange={(e) => setPlaylistId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Nenhum</option>
              {playlists?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="tx-notes">Notas (opcional)</Label>
        <Input id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !account}>
          {initial ? "Salvar" : "Adicionar"}
        </Button>
      </div>
    </form>
  )
}
