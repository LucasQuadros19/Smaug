import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  Landmark,
  PiggyBank,
  Wallet,
} from "lucide-react"
import type { ReactNode } from "react"
import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"

/** Variação vs. o mês anterior. `goodWhenUp` inverte a cor para despesas. */
function Delta({
  current,
  previous,
  goodWhenUp = true,
}: {
  current: number
  previous: number
  goodWhenUp?: boolean
}) {
  // Sem base de comparação não há variação a mostrar.
  if (!previous) return null

  const diff = current - previous
  if (Math.abs(diff) < 0.01) {
    return <p className="text-[11px] text-slate-400">igual ao mês passado</p>
  }

  const up = diff > 0
  const good = goodWhenUp ? up : !up
  const percent = Math.abs((diff / Math.abs(previous)) * 100)

  return (
    <p
      className={`flex items-center gap-0.5 text-[11px] ${
        good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {percent < 1000 ? `${percent.toFixed(0)}%` : "muito"} vs. mês passado
    </p>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone,
  caption,
  delta,
}: {
  label: string
  value: number
  icon: ReactNode
  tone: "neutral" | "positive" | "negative"
  caption?: string
  delta?: ReactNode
}) {
  const toneClasses = {
    neutral: "text-indigo-600 bg-indigo-600/10 dark:text-indigo-300 dark:bg-indigo-500/15",
    positive: "text-emerald-600 bg-emerald-600/10 dark:text-emerald-300 dark:bg-emerald-500/15",
    negative: "text-rose-600 bg-rose-600/10 dark:text-rose-300 dark:bg-rose-500/15",
  }[tone]

  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {/* O valor nunca trunca: um patrimônio cortado em "R$ 100.811,..." é
            pior do que fonte um pouco menor. Só cresce quando há espaço. */}
        <p className="text-base font-semibold whitespace-nowrap text-slate-900 2xl:text-lg dark:text-white">
          {formatCurrency(value)}
        </p>
        {caption && (
          <p className="truncate text-[11px] text-slate-400" title={caption}>
            {caption}
          </p>
        )}
        {delta}
      </div>
    </Card>
  )
}

export function BalanceCards({
  netWorth,
  cashBalance,
  parkedInAssets,
  parkedInPlaylists,
  monthIncome,
  monthExpense,
  monthSavings,
  previousMonth,
}: {
  netWorth: number
  cashBalance: number
  parkedInAssets: number
  parkedInPlaylists: number
  monthIncome: number
  monthExpense: number
  monthSavings: number
  previousMonth?: { income: number; expense: number; savings: number }
}) {
  const parked = parkedInAssets + parkedInPlaylists

  // Cinco colunas só a partir de 2xl: em 1280px os cards ficavam estreitos
  // demais e cortavam o valor. Abaixo disso, três colunas cabem inteiras.
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <StatCard
        label="Patrimônio total"
        value={netWorth}
        icon={<Landmark size={20} />}
        tone="neutral"
        caption={parked > 0 ? `Contas + ${formatCurrency(parked)} em ativos/grupos` : undefined}
      />
      <StatCard
        label="Disponível em contas"
        value={cashBalance}
        icon={<Wallet size={20} />}
        tone={cashBalance >= 0 ? "neutral" : "negative"}
        caption="O que sobra líquido agora"
      />
      <StatCard
        label="Receitas do mês"
        value={monthIncome}
        icon={<ArrowUpRight size={20} />}
        tone="positive"
        delta={
          previousMonth && <Delta current={monthIncome} previous={previousMonth.income} />
        }
      />
      <StatCard
        label="Despesas do mês"
        value={monthExpense}
        icon={<ArrowDownRight size={20} />}
        tone="negative"
        delta={
          previousMonth && (
            <Delta current={monthExpense} previous={previousMonth.expense} goodWhenUp={false} />
          )
        }
      />
      <StatCard
        label="Economia do mês"
        value={monthSavings}
        icon={<PiggyBank size={20} />}
        tone={monthSavings >= 0 ? "positive" : "negative"}
        delta={
          previousMonth && <Delta current={monthSavings} previous={previousMonth.savings} />
        }
      />
    </div>
  )
}
