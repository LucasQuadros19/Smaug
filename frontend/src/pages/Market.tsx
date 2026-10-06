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
  onSubmit: (data: { quantity: number; price: number; date: string; account_id: number | null; notes: string | null }) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: accounts } = useAccounts()
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState(symbol.quote ? String(symbol.quote.price) : "")
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState(0)
  const [notes, setNotes] = useState("")

  const total = (Number(quantity) || 0) * (Number(price) || 0)
  const held = symbol.holding?.quantity ?? 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ quantity: Number(quantity), price: Number(price), date, account_id: accountId || null, notes: notes || null })
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
        {accountId > 0 && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            {side === "buy" ? "Sai" : "Entra"} {symbol.currency !== "BRL" ? "o valor em reais " : ""}na conta e conta como{" "}
            {side === "buy" ? "saída" : "entrada"} do mês. Enquanto o Mercado é área de teste, a ação não entra no
            patrimônio — então uma compra faz o patrimônio cair.
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
    </Card>
  )
}

export function Market() {
  const { data, isLoading, error } = useMarket()
  const { addTrade, removeTrade, removeSymbol } = useMarketMutations()
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
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Área de teste: o que está aqui não entra no patrimônio nem nos ativos.
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
                onRemoveTrade={(id) => removeTrade.mutate(id)}
                onRemove={() => removeSymbol.mutate(symbol.id)}
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
