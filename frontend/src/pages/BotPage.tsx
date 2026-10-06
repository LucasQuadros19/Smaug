import { Activity, Bot, CircleDollarSign, Percent, TrendingUp } from "lucide-react"
import clsx from "clsx"
import { Topbar } from "../components/layout/Topbar"
import { Card } from "../components/ui/Card"
import { PriceChart } from "../components/market/PriceChart"
import { Change } from "../components/market/SymbolRow"
import { formatMoney } from "../lib/format"
import { seriesColor } from "../lib/chartTheme"
import { useTheme } from "../context/ThemeContext"

// ---------------------------------------------------------------------------
// DADOS DE EXEMPLO — só para desenhar a tela. Na integração, isto vira a
// resposta do servidor dos bots (mesmo formato, ou adaptado aqui).
// ---------------------------------------------------------------------------
type BotStatus = "running" | "paused" | "error"

const EXAMPLE = {
  currency: "USD", // bots operam em USDT
  bots: [
    { id: 1, name: "Grid BTC", pair: "BTC/USDT", strategy: "Grid", status: "running" as BotStatus, capital: 1500, profit: 142.3, trades: 318, lastTrade: "há 4 min", uptime: "12d 4h" },
    { id: 2, name: "DCA ETH", pair: "ETH/USDT", strategy: "DCA", status: "running" as BotStatus, capital: 800, profit: 37.8, trades: 41, lastTrade: "há 2 h", uptime: "30d 1h" },
    { id: 3, name: "Scalper SOL", pair: "SOL/USDT", strategy: "Scalping", status: "paused" as BotStatus, capital: 400, profit: -12.5, trades: 96, lastTrade: "ontem", uptime: "—" },
    { id: 4, name: "Grid BNB", pair: "BNB/USDT", strategy: "Grid", status: "error" as BotStatus, capital: 300, profit: 8.1, trades: 22, lastTrade: "há 3 dias", uptime: "—" },
  ],
  recentTrades: [
    { bot: "Grid BTC", pair: "BTC/USDT", side: "sell" as const, price: 85420, amount: 0.0021, result: 1.84, time: "14:32" },
    { bot: "Grid BTC", pair: "BTC/USDT", side: "buy" as const, price: 85120, amount: 0.0021, result: null, time: "14:05" },
    { bot: "DCA ETH", pair: "ETH/USDT", side: "buy" as const, price: 2701.5, amount: 0.05, result: null, time: "12:10" },
    { bot: "Grid BTC", pair: "BTC/USDT", side: "sell" as const, price: 85390, amount: 0.0021, result: 1.62, time: "11:47" },
    { bot: "Scalper SOL", pair: "SOL/USDT", side: "sell" as const, price: 119.8, amount: 2, result: -0.94, time: "ontem" },
  ],
  winRate: 64,
  profitToday: 6.4,
}

/** Lucro acumulado de 30 dias, determinístico (não muda a cada render). */
function exampleSeries() {
  const day = 86_400_000
  const start = Date.now() - 29 * day
  let total = 0
  return Array.from({ length: 30 }, (_, i) => {
    total += 6 + Math.sin(i * 1.7) * 9 + Math.cos(i * 0.6) * 4
    return { t: start + i * day, v: Math.round(total * 100) / 100 }
  })
}
const SERIES = exampleSeries()
// ---------------------------------------------------------------------------

const STATUS: Record<BotStatus, { label: string; dot: string; text: string }> = {
  running: { label: "Rodando", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Pausado", dot: "bg-slate-400", text: "text-slate-500 dark:text-slate-400" },
  error: { label: "Erro", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
}

const usd = (v: number) => formatMoney(v, EXAMPLE.currency)

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Bot; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  )
}

export function BotPage() {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const { bots, recentTrades, winRate, profitToday } = EXAMPLE

  const running = bots.filter((b) => b.status === "running").length
  const capital = bots.reduce((s, b) => s + b.capital, 0)
  const profit = bots.reduce((s, b) => s + b.profit, 0)

  // Moedas usadas: quanto do capital está em cada par.
  const coins = Object.entries(
    bots.reduce<Record<string, number>>((acc, b) => {
      const coin = b.pair.split("/")[0]
      acc[coin] = (acc[coin] ?? 0) + b.capital
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <Topbar title="Bot" />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Dados de exemplo — a integração com o servidor dos bots ainda vai ser feita.
        </p>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Activity} label="Bots ativos" value={`${running} de ${bots.length}`} sub={`${bots.length - running} parado(s)`} />
          <Kpi
            icon={TrendingUp}
            label="Lucro total"
            value={<span className={profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{usd(profit)}</span>}
            sub={<Change pct={(profit / capital) * 100} />}
          />
          <Kpi icon={CircleDollarSign} label="Capital alocado" value={usd(capital)} sub={`hoje ${usd(profitToday)}`} />
          <Kpi icon={Percent} label="Operações com lucro" value={`${winRate}%`} sub={`${bots.reduce((s, b) => s + b.trades, 0)} operações`} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lucro acumulado</h3>
              <span className="text-xs text-slate-400">últimos 30 dias</span>
            </div>
            <PriceChart data={SERIES} range="1mo" format={usd} height={240} />
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Moedas usadas</h3>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
              {coins.map(([coin, value], i) => (
                <div key={coin} style={{ width: `${(value / capital) * 100}%`, backgroundColor: seriesColor(i, isDark) }} title={coin} />
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {coins.map(([coin, value], i) => (
                <li key={coin} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seriesColor(i, isDark) }} />
                    {coin}
                    <span className="text-xs text-slate-400">{Math.round((value / capital) * 100)}%</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{usd(value)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="overflow-x-auto p-0">
          <h3 className="px-5 pt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Bots</h3>
          <table className="mt-2 w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-white/5">
                <th className="px-5 py-2 font-medium">Bot</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Par</th>
                <th className="px-5 py-2 text-right font-medium">Capital</th>
                <th className="px-5 py-2 text-right font-medium">Lucro</th>
                <th className="px-5 py-2 text-right font-medium">Operações</th>
                <th className="px-5 py-2 font-medium">Última</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {bots.map((b) => {
                const status = STATUS[b.status]
                return (
                  <tr key={b.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{b.name}</p>
                      <p className="text-xs text-slate-400">{b.strategy} · no ar {b.uptime}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium", status.text)}>
                        <span className={clsx("h-2 w-2 rounded-full", status.dot, b.status === "running" && "animate-pulse")} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{b.pair}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{usd(b.capital)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={b.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {usd(b.profit)}
                      </span>
                      <Change pct={(b.profit / b.capital) * 100} className="block text-xs" />
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{b.trades}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{b.lastTrade}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Últimas operações</h3>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
            {recentTrades.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                      t.side === "buy" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {t.side === "buy" ? "COMPRA" : "VENDA"}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">{t.pair}</span>
                  <span className="text-xs text-slate-400">{t.bot}</span>
                </span>
                <span className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {t.amount} × {usd(t.price)}
                  </span>
                  {t.result != null && (
                    <span className={t.result >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {t.result >= 0 ? "+" : ""}
                      {usd(t.result)}
                    </span>
                  )}
                  <span className="w-12 text-right">{t.time}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </>
  )
}
