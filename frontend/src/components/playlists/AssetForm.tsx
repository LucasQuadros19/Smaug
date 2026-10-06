import { useState } from "react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { ColorPicker } from "../ui/ColorPicker"
import { IconPicker } from "../ui/IconPicker"
import { Toggle } from "../ui/Toggle"
import { useAccounts } from "../../hooks/useAccounts"
import { formatCurrency, todayISO } from "../../lib/format"
import { useRates } from "../../hooks/useDashboard"
import { ASSET_TYPES, CURRENCIES } from "../../lib/constants"
import type { AssetType, Currency, Playlist } from "../../types"
import type { PlaylistInput } from "../../api/playlists"

export interface AssetInitialEntry {
  account_id: number
  amount: number
  date: string
}

type ValueSource = "declare" | "account"

export function AssetForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Playlist
  onSubmit: (data: PlaylistInput, initialEntry?: AssetInitialEntry) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [color, setColor] = useState(initial?.color ?? "#f59e0b")
  const [icon, setIcon] = useState(initial?.icon ?? "🤝")
  const [countsInNetWorth, setCountsInNetWorth] = useState(initial?.counts_in_net_worth ?? true)
  const [fromLoans, setFromLoans] = useState(initial?.auto_source === "loans")
  const [assetType, setAssetType] = useState<AssetType>(initial?.asset_type ?? "investment")
  const [source, setSource] = useState<ValueSource>("declare")
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "BRL")
  // Automática mostra o valor que vem da origem; as outras, o valor na moeda delas.
  const shownValue = initial?.auto_source ? initial.opening_value : initial?.native_value
  const [amount, setAmount] = useState(shownValue && shownValue > 0 ? String(shownValue) : "")
  const [accountId, setAccountId] = useState(0)
  const [date, setDate] = useState(todayISO())

  const { data: accounts } = useAccounts()
  const { data: rates } = useRates()
  const isCreating = !initial
  const value = Number(amount) || 0
  const foreign = currency !== "BRL"
  const rate = rates?.[currency]?.rate

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        // Em outra moeda o valor é sempre declarado: a conta é em reais.
        const declaring = !isCreating || source === "declare" || foreign
        const playlistData: PlaylistInput = {
          name,
          description: description || null,
          color,
          icon,
          kind: "asset",
          counts_in_net_worth: countsInNetWorth,
          opening_value: declaring ? value : 0,
          currency: fromLoans ? "BRL" : currency,
          auto_source: fromLoans ? "loans" : null,
          asset_type: assetType,
        }
        const initialEntry =
          isCreating && !foreign && source === "account" && value > 0 && accountId
            ? { account_id: accountId, amount: value, date }
            : undefined
        onSubmit(playlistData, initialEntry)
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nome</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Empréstimo - João, Moto, Obra Rua X..."
          required
        />
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Do que se trata"
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(ASSET_TYPES) as AssetType[]).map((t) => {
            const tipo = ASSET_TYPES[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setAssetType(t)}
                title={tipo.hint}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors",
                  assetType === t
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20"
                )}
              >
                <span className="text-base">{tipo.icon}</span>
                {tipo.label}
              </button>
            )
          })}
        </div>
        {/* A diferença que mais importa, dita sem jargão. */}
        <p className="mt-1.5 text-xs text-slate-400">
          {ASSET_TYPES[assetType].mode === "declarado"
            ? "O valor é uma cotação sua (FIPE, avaliação). Os lançamentos aqui dentro são gastos e receitas de verdade: saem da conta e contam no mês, sem mexer no valor."
            : "O valor é o dinheiro aplicado: lançar uma saída aumenta a posição (aporte) e uma entrada diminui (retorno). Não conta como gasto do mês — é patrimônio mudando de forma."}
        </p>
      </div>

      <div>
        <Label>Ícone</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div>
        <Label>Cor</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <Toggle
        checked={countsInNetWorth}
        onChange={setCountsInNetWorth}
        label="Contar no patrimônio total"
        hint="Ligado para coisas que você recupera: empréstimo a receber, moto que pode ser vendida, investimento. Desligue se o dinheiro simplesmente foi embora."
      />

      <Toggle
        checked={fromLoans}
        onChange={setFromLoans}
        label="Puxar valor da tela de Empréstimos"
        hint="Liga esta posição à tela de Empréstimos: o valor passa a ser a soma da sua parte nos empréstimos em aberto, atualizada sozinha. Deixe desligado para digitar o valor à mão."
      />

      <div
        className={
          fromLoans
            ? "space-y-4 rounded-xl border border-slate-100 p-3 opacity-50 dark:border-white/5"
            : "space-y-4 rounded-xl border border-slate-100 p-3 dark:border-white/5"
        }
      >
        {!fromLoans && (
          <div>
            <Label>Moeda em que você acompanha</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                <option key={c} value={c}>
                  {CURRENCIES[c]}
                </option>
              ))}
            </Select>
            {foreign && (
              <p className="mt-1.5 text-xs text-slate-400">
                O valor fica em {currency} e entra no patrimônio convertido pela cotação do momento,
                atualizada a cada minuto.
              </p>
            )}
          </div>
        )}

        <div>
          <Label>
            {fromLoans
              ? "Valor (vem dos Empréstimos)"
              : `Quanto vale esse ativo${foreign ? ` (em ${currency})` : ""}`}
          </Label>
          <Input
            type="number"
            step={currency === "BTC" ? "0.00000001" : "0.01"}
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            readOnly={fromLoans}
          />
          {foreign && !fromLoans && (
            <p className="mt-1 text-xs text-slate-400">
              {rate
                ? `≈ ${formatCurrency(value * rate)} · 1 ${currency} = ${formatCurrency(rate)}`
                : "Sem cotação no momento — o valor em reais aparece quando a internet voltar."}
            </p>
          )}
        </div>

        {isCreating && !fromLoans && !foreign && (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
              {(["declare", "account"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={clsx(
                    "rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                    source === s ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {s === "declare" ? "Já tenho isso" : "Sai da conta agora"}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {source === "declare"
                ? "O ativo entra no patrimônio pelo valor informado e nenhuma conta é debitada — você já tinha isso antes."
                : "O valor é debitado da conta escolhida, como uma saída de dinheiro de verdade acontecendo agora."}
            </p>
          </>
        )}

        {isCreating && !fromLoans && !foreign && source === "account" && (
          <>
            <div>
              <Label>Sai de qual conta</Label>
              <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
                <option value={0}>Selecione</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </>
        )}

        {!isCreating && (
          <p className="text-xs text-slate-400">
            Esse é o valor declarado do ativo (o que já era seu). Aportes feitos depois entram como
            lançamentos e são somados por cima.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={
            submitting || (isCreating && !foreign && source === "account" && value > 0 && !accountId)
          }
        >
          {initial ? "Salvar" : "Criar ativo"}
        </Button>
      </div>
    </form>
  )
}
