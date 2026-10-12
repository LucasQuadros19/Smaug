import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { Input, Label, Select } from "../components/ui/Input"
import { SegmentedControl } from "../components/ui/SegmentedControl"
import { PriceChart } from "../components/market/PriceChart"
import { Change, SymbolRow, type Money } from "../components/market/SymbolRow"
import { useMarket, useMarketMutations, usePortfolioHistory } from "../hooks/useMarket"
import { useAccounts } from "../hooks/useAccounts"
import { useSettings } from "../hooks/useMe"
import { useConfirm } from "../components/ui/ConfirmDialog"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { formatCurrency, formatMoney, todayISO } from "../lib/format"
import type { MarketKind, MarketRange, MarketSymbol } from "../types"

type Display = "original" | "brl"

/** Preço unitário pode ser centavos (ou fração de cripto): até 4 casas abaixo de 1. */
function money(value: number, currency: string) {
  if (Math.abs(value) >= 1 || value === 0) return formatMoney(value, currency)
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 6 }).format(value)
}

function buildMoney(display: Display): Money {
  const toBrl = display === "brl"
  // Sem cotação da moeda (sem internet), mostra na moeda original em vez de R$ 0.
  const inBrl = (s: MarketSymbol) => s.currency === "BRL" || (toBrl && s.rate != null)
  return {
    native: (value, s) => (inBrl(s) ? money(value * (s.rate ?? 1), "BRL") : money(value, s.currency)),
    brl: (value, s) =>
      toBrl || s.currency === "BRL" || !s.rate ? formatCurrency(value) : money(value / s.rate, s.currency),
    chartValue: (value, s) => (inBrl(s) ? value * (s.rate ?? 1) : value),
    chartFormat: (s) => (value) => money(value, inBrl(s) ? "BRL" : s.currency),
  }
}

function AddSymbolForm({ onDone }: { onDone: () => void }) {
  const { addSymbol } = useMarketMutations()
  const [kind, setKind] = useState<MarketKind>("stock")
  const [code, setCode] = useState("")
  const { submit, error } = useFormSubmit(onDone)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(addSymbol.mutateAsync({ code, kind }))
      }}
      className="space-y-4"
    >
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
      <SegmentedControl
        value={kind}
        onChange={setKind}
        ariaLabel="Tipo"
        options={[
          { value: "stock", label: "Ação" },
          { value: "crypto", label: "Cripto" },
        ]}
      />
      <div>
        <Label>Código</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={kind === "stock" ? "WEGE3, PETR4, AAPL, MSFT..." : "BTC, ETH, SOL..."}
          autoFocus
          required
        />
        <p className="mt-1.5 text-xs text-slate-400">
          {kind === "stock"
            ? "Ações da B3 e dos EUA. Cotação via Yahoo, com cerca de 15 min de atraso."
            : "Cotação via CoinGecko, praticamente ao vivo, em dólar."}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={addSymbol.isPending}>
          {addSymbol.isPending ? "Procurando..." : "Adicionar"}
        </Button>
      </div>
    </form>
  )
}

function TradeForm({
  symbol,
  side,
  onSubmit,
  onCancel,
  submitting,
}: {
  symbol: MarketSymbol
  side: "buy" | "sell"
  onSubmit: (data: { quantity: number; price: number; date: string; account_id: number | null; fees: number; notes: string | null }) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: accounts } = useAccounts()
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState(symbol.quote ? String(symbol.quote.price) : "")
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState(0)
  const [notes, setNotes] = useState("")

  const { settings } = useSettings()
  const [fees, setFees] = useState<string | null>(null)
  const total = (Number(quantity) || 0) * (Number(price) || 0)
  const totalBrl = total * (symbol.rate ?? 1)
  const held = symbol.holding?.quantity ?? 0
  // Taxas pelos padrões: corretagem por ordem + taxas da B3 (só ações da B3). Dá para mudar.
  const b3 = symbol.kind === "stock" && symbol.currency === "BRL"
  const suggestedFees = total > 0 ? Math.round((settings.order_fee + (b3 ? (totalBrl * settings.b3_fee) / 100 : 0)) * 100) / 100 : 0
  const feeValue = fees === null ? suggestedFees : Number(fees) || 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ quantity: Number(quantity), price: Number(price), date, account_id: accountId || null, fees: feeValue, notes: notes || null })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quantidade{side === "sell" && ` (tem ${held.toLocaleString("pt-BR")})`}</Label>
          <Input type="number" step="any" min="0" max={side === "sell" ? held : undefined} value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label>Preço por unidade ({symbol.currency})</Label>
          <Input type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Taxas (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={fees ?? (suggestedFees ? String(suggestedFees) : "")}
            onChange={(e) => setFees(e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div>
          <Label>Conta (opcional)</Label>
          <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            <option value={0}>Não mexer em conta</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[0.03]">
        <p className="text-xs text-slate-400">Total</p>
        <p className="font-semibold text-slate-900 dark:text-white">
          {money(total, symbol.currency)}
          {symbol.currency !== "BRL" && symbol.rate && (
            <span className="ml-2 text-xs font-normal text-slate-400">≈ {formatCurrency(total * symbol.rate)}</span>
          )}
        </p>
        {feeValue > 0 && (
          <p className="text-xs text-slate-400">
            {side === "buy" ? "+" : "−"} {formatCurrency(feeValue)} de taxas ={" "}
            {formatCurrency(side === "buy" ? totalBrl + feeValue : totalBrl - feeValue)}
          </p>
        )}
        {accountId > 0 && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {side === "buy" ? "Sai da" : "Entra na"} conta e o dinheiro {side === "buy" ? "vira ação" : "volta da ação"} no
            patrimônio — não conta como {side === "buy" ? "gasto" : "receita"} do mês.
          </p>
        )}
      </div>

      <div>
        <Label>Observação (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: corretora X" />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {side === "buy" ? "Registrar compra" : "Registrar venda"}
        </Button>
      </div>
    </form>
  )
}

function PortfolioCard({ hasTrades }: { hasTrades: boolean }) {
  const { data } = useMarket()
  const [range, setRange] = useState<MarketRange>("6mo")
  const { data: history, isLoading } = usePortfolioHistory(range, hasTrades)
  const p = data?.portfolio
  if (!p || !hasTrades) return null

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">Minha carteira</p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">{formatCurrency(p.value_brl)}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            <span>
              <Change pct={p.day_change_pct} /> <span className="text-slate-400">hoje ({formatCurrency(p.day_change_brl)})</span>
            </span>
            <span>
              <Change pct={p.gain_pct} />{" "}
              <span className="text-slate-400">desde a compra ({formatCurrency(p.gain_brl)})</span>
            </span>
          </p>
          {p.missing_quotes && <p className="mt-1 text-xs text-amber-600">Algum código está sem cotação agora — o total pode estar baixo.</p>}
        </div>
        <SegmentedControl
          value={range}
          onChange={setRange}
          ariaLabel="Período da carteira"
          options={[
            { value: "1mo", label: "1M" },
            { value: "6mo", label: "6M" },
            { value: "1y", label: "1A" },
            { value: "5y", label: "5A" },
          ]}
        />
      </div>
      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Carregando...</div>
      ) : (
        <PriceChart
          data={(history ?? []).map((pt) => ({ t: Date.parse(`${pt.date}T12:00:00`), v: pt.value, invested: pt.invested }))}
          range={range}
          format={formatCurrency}
        />
      )}
      <p className="text-[11px] text-slate-400">
        Linha tracejada: quanto você tinha investido. Valores em dólar usam a cotação de hoje.
      </p>
      {data && <TaxEstimate tax={data.tax} />}
    </Card>
  )
}

/** IR estimado do mês: só aparece quando houve venda. */
function TaxEstimate({ tax }: { tax: NonNullable<ReturnType<typeof useMarket>["data"]>["tax"] }) {
  const lines = [
    { label: "Ações da B3", ...tax.stock },
    { label: "Cripto", ...tax.crypto },
  ].filter((line) => line.sales > 0)
  if (lines.length === 0) return null
  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-white/5">
      <p className="font-medium text-slate-600 dark:text-slate-300">IR estimado deste mês</p>
      {lines.map((line) => (
        <p key={line.label} className="text-slate-500 dark:text-slate-400">
          {line.label}: vendeu {formatCurrency(line.sales)}, lucro {formatCurrency(line.realized)} —{" "}
          {line.tax > 0 ? (
            <span className="font-medium text-rose-600 dark:text-rose-400">
              {formatCurrency(line.tax)} ({line.rate}%)
            </span>
          ) : line.sales <= line.exempt_until ? (
            `isento (vendas até ${formatCurrency(line.exempt_until)})`
          ) : (
            "sem lucro, sem imposto"
          )}
        </p>
      ))}
      <p className="text-[11px] text-slate-400">
        Estimativa: não compensa prejuízo de meses anteriores nem trata day trade. As taxas vêm das Configurações.
      </p>
    </div>
  )
}

export function Market() {
  const { data, isLoading, error } = useMarket()
  const { addTrade, removeTrade, removeSymbol } = useMarketMutations()
  const ask = useConfirm()
  const askRemoveTrade = (symbol: MarketSymbol, id: number) => {
    const t = symbol.trades.find((x) => x.id === id)
    ask({
      title: `Apagar ${t?.side === "sell" ? "venda" : "compra"} de ${symbol.code}?`,
      message: t ? `${t.quantity.toLocaleString("pt-BR")} × ${formatMoney(t.price, symbol.currency)} em ${t.date.split("-").reverse().join("/")}.` : "",
      consequences: [
        t?.account_id ? "O lançamento na conta some junto e o saldo volta." : "Não mexeu em conta: só o registro some.",
        "A posição Mercado no patrimônio é recalculada.",
      ],
      action: () => removeTrade.mutateAsync(id),
      done: "Registro apagado",
    })
  }
  const askRemoveSymbol = (symbol: MarketSymbol) =>
    ask({
      title: `Tirar ${symbol.code} da lista?`,
      message: `${symbol.name} deixa de ser acompanhado.`,
      consequences:
        symbol.trades.length > 0
          ? [
              `As ${symbol.trades.length} compra(s)/venda(s) registradas somem junto.`,
              "Os lançamentos que elas fizeram nas contas também saem do caixa.",
            ]
          : undefined,
      confirmLabel: "Tirar da lista",
      action: () => removeSymbol.mutateAsync(symbol.id),
      done: `${symbol.code} saiu da lista`,
    })
  const [display, setDisplay] = useState<Display>("original")
  const [adding, setAdding] = useState(false)
  const [trading, setTrading] = useState<{ symbol: MarketSymbol; side: "buy" | "sell" } | null>(null)
  const trade = useFormSubmit(() => setTrading(null))
  const moneyFns = useMemo(() => buildMoney(display), [display])

  const symbols = data?.symbols ?? []
  const hasTrades = symbols.some((s) => s.trades.length > 0)

  return (
    <>
      <Topbar
        title="Mercado"
        action={
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={display}
              onChange={setDisplay}
              ariaLabel="Moeda"
              options={[
                { value: "original", label: "Moeda original" },
                { value: "brl", label: "R$" },
              ]}
            />
            <Button onClick={() => setAdding(true)}>
              <Plus size={16} /> Adicionar
            </Button>
          </div>
        }
      />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <p className="text-xs text-slate-400">
          Tudo o que você tem aqui entra no patrimônio pela posição "Mercado", sempre pela cotação de agora.
        </p>

        <PortfolioCard hasTrades={hasTrades} />

        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando cotações...</p>
        ) : error ? (
          <p className="text-sm text-rose-500">{(error as Error).message}</p>
        ) : symbols.length === 0 ? (
          <Card className="py-8 text-center text-sm text-slate-400">
            Nenhum código ainda. Adicione ações (WEGE3, AAPL) ou cripto (BTC) para acompanhar.
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 p-0 dark:divide-white/5">
            <div className="hidden grid-cols-[1.25rem_minmax(0,2fr)_1fr_1fr_1fr_1fr] gap-3 px-4 py-2 text-xs text-slate-400 md:grid">
              <span />
              <span>Código</span>
              <span>Preço</span>
              <span>Dia</span>
              <span>Tenho</span>
              <span>Ganho</span>
            </div>
            {symbols.map((symbol) => (
              <SymbolRow
                key={symbol.id}
                symbol={symbol}
                money={moneyFns}
                onTrade={(side) => {
                  trade.reset()
                  setTrading({ symbol, side })
                }}
                onRemoveTrade={(id) => askRemoveTrade(symbol, id)}
                onRemove={() => askRemoveSymbol(symbol)}
              />
            ))}
          </Card>
        )}
      </main>

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar à lista">
        {adding && <AddSymbolForm onDone={() => setAdding(false)} />}
      </Modal>

      <Modal
        open={Boolean(trading)}
        onClose={() => setTrading(null)}
        title={trading ? `${trading.side === "buy" ? "Comprei" : "Vendi"} ${trading.symbol.code}` : ""}
        error={trade.error}
      >
        {trading && (
          <TradeForm
            symbol={trading.symbol}
            side={trading.side}
            submitting={addTrade.isPending}
            onCancel={() => setTrading(null)}
            onSubmit={(input) => trade.submit(addTrade.mutateAsync({ ...input, symbol_id: trading.symbol.id, side: trading.side }))}
          />
        )}
      </Modal>
    </>
  )
}
