import { useState } from "react"
import { ChevronRight, Minus, Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { SegmentedControl } from "../ui/SegmentedControl"
import { PriceChart } from "./PriceChart"
import { useSymbolHistory } from "../../hooks/useMarket"
import { formatDate } from "../../lib/format"
import type { MarketRange, MarketSymbol } from "../../types"

export type Money = {
  /** Valor na moeda do código, exibido conforme a escolha (R$ ou original). */
  native: (value: number, symbol: MarketSymbol) => string
  /** Valor que já está em reais, exibido conforme a escolha. */
  brl: (value: number, symbol: MarketSymbol) => string
  /** Converte para o gráfico: na moeda escolhida. */
  chartValue: (value: number, symbol: MarketSymbol) => number
  chartFormat: (symbol: MarketSymbol) => (value: number) => string
}

const RANGES: { value: MarketRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1A" },
  { value: "5y", label: "5A" },
]

const quantityFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 })

export function Change({ pct, className }: { pct: number | null | undefined; className?: string }) {
  if (pct == null) return <span className={clsx("text-slate-400", className)}>—</span>
  const up = pct >= 0
  return (
    <span className={clsx(up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400", className)}>
      {up ? "▲" : "▼"} {Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
    </span>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  )
}

function Detail({
  symbol,
  money,
  onTrade,
  onRemoveTrade,
  onRemove,
}: {
  symbol: MarketSymbol
  money: Money
  onTrade: (side: "buy" | "sell") => void
  onRemoveTrade: (id: number) => void
  onRemove: () => void
}) {
  const [range, setRange] = useState<MarketRange>("1mo")
  const { data, isLoading, error } = useSymbolHistory(symbol.id, range)
  const q = symbol.quote
  const h = symbol.holding
  const ranges = symbol.kind === "crypto" ? RANGES.filter((r) => r.value !== "5y") : RANGES

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 px-4 py-4 dark:border-white/5 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl value={range} options={ranges} onChange={setRange} ariaLabel="Período do gráfico" />
        {q?.updated_at && (
          <span className="text-[11px] text-slate-400">
            atualizado {new Date(q.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            {symbol.kind === "stock" && " · ações com ~15 min de atraso"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Carregando gráfico...</div>
      ) : error ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-rose-500">{(error as Error).message}</div>
      ) : (
        <PriceChart
          data={(data ?? []).map((p) => ({ t: p.t, v: money.chartValue(p.v, symbol) }))}
          range={range}
          format={money.chartFormat(symbol)}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Fechamento anterior" value={q?.previous_close ? money.native(q.previous_close, symbol) : "—"} />
        <Stat
          label={symbol.kind === "crypto" ? "Máx. / mín. 24h" : "Máx. / mín. do dia"}
          value={q?.day_high && q?.day_low ? `${money.native(q.day_high, symbol)} / ${money.native(q.day_low, symbol)}` : "—"}
        />
        {symbol.kind === "stock" && (
          <Stat
            label="52 semanas (máx.)"
            value={q?.year_high ? money.native(q.year_high, symbol) : "—"}
          />
        )}
        <Stat label="Moeda" value={symbol.currency} />
      </div>

      {h && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-4 dark:border-white/5">
          <Stat label="Quantidade" value={quantityFormat.format(h.quantity)} />
          <Stat label="Preço médio" value={money.native(h.average_price, symbol)} />
          <Stat label="Investido" value={money.brl(h.cost_brl, symbol)} />
          <Stat
            label="Ganho"
            value={
              h.gain_brl == null ? "—" : (
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  {money.brl(h.gain_brl, symbol)} <Change pct={h.gain_pct} className="text-xs" />
                </span>
              )
            }
          />
          {h.realized_brl !== 0 && <Stat label="Já realizado em vendas" value={money.brl(h.realized_brl, symbol)} />}
        </div>
      )}

      {symbol.trades.length > 0 && (
        <ul className="space-y-1 text-xs">
          {symbol.trades.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                {formatDate(t.date)} ·{" "}
                <span className={t.side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {t.side === "buy" ? "Compra" : "Venda"}
                </span>{" "}
                {quantityFormat.format(t.quantity)} × {money.native(t.price, symbol)}
                {t.account_id && " · mexeu na conta"}
              </span>
              <button
                onClick={() => confirm("Apagar esse registro? Se mexeu numa conta, o lançamento some junto.") && onRemoveTrade(t.id)}
                className="rounded p-0.5 text-slate-300 hover:text-rose-500 dark:text-slate-600"
                aria-label="Apagar registro"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onTrade("buy")}>
          <Plus size={15} /> Comprei
        </Button>
        {h && h.quantity > 0 && (
          <Button variant="secondary" onClick={() => onTrade("sell")}>
            <Minus size={15} /> Vendi
          </Button>
        )}
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => confirm(`Tirar ${symbol.code} da lista? Compras registradas somem junto.`) && onRemove()}
        >
          <Trash2 size={15} /> Remover
        </Button>
      </div>
    </div>
  )
}

export function SymbolRow({
  symbol,
  money,
  onTrade,
  onRemoveTrade,
  onRemove,
}: {
  symbol: MarketSymbol
  money: Money
  onTrade: (side: "buy" | "sell") => void
  onRemoveTrade: (id: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const q = symbol.quote
  const h = symbol.holding

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 md:grid-cols-[1.25rem_minmax(0,2fr)_1fr_1fr_1fr_1fr] dark:hover:bg-white/[0.03]"
      >
        <ChevronRight size={16} className={clsx("text-slate-400 transition-transform", open && "rotate-90")} />
        <span className="min-w-0">
          <span className="block font-semibold text-slate-900 dark:text-white">{symbol.code}</span>
          <span className="block truncate text-xs text-slate-400">{symbol.name}</span>
        </span>
        <span className="text-right md:text-left">
          <span className="block font-medium text-slate-800 dark:text-slate-100">
            {q ? money.native(q.price, symbol) : "sem cotação"}
          </span>
          <Change pct={q?.change_pct} className="text-xs md:hidden" />
        </span>
        <Change pct={q?.change_pct} className="hidden text-sm md:block" />
        <span className="hidden text-sm text-slate-600 md:block dark:text-slate-300">
          {h && h.quantity > 0 ? (
            <>
              {quantityFormat.format(h.quantity)}
              <span className="block text-xs text-slate-400">{h.value_brl != null ? money.brl(h.value_brl, symbol) : "—"}</span>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </span>
        <span className="hidden text-sm md:block">
          {h && h.quantity > 0 && h.gain_brl != null ? (
            <>
              <span className={h.gain_brl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {money.brl(h.gain_brl, symbol)}
              </span>
              <Change pct={h.gain_pct} className="block text-xs" />
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </span>
      </button>
      {open && <Detail symbol={symbol} money={money} onTrade={onTrade} onRemoveTrade={onRemoveTrade} onRemove={onRemove} />}
    </div>
  )
}
