import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import type { DashboardSummary } from "../../types"

export function WealthOverview({ summary }: { summary: DashboardSummary }) {
  const excluded = summary.playlists_summary.filter((p) => !p.counts_in_net_worth).length

  const stats: { label: string; value: number; emphasis?: boolean; hint?: string }[] = [
    {
      label: "Patrimônio total",
      value: summary.net_worth,
      emphasis: true,
      hint: "Contas + ativos + grupos que contam",
    },
    { label: "Disponível em contas", value: summary.total_balance, hint: "O que sobra líquido" },
    { label: "Em ativos", value: summary.parked_in_assets },
    { label: "Em grupos", value: summary.parked_in_playlists },
    { label: "Aportado em ativos", value: summary.asset_summary.total_invested },
    { label: "Recebido em ativos", value: summary.asset_summary.total_returned },
  ]

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Onde está o seu dinheiro
        </h3>
        {excluded > 0 && (
          <p className="text-xs text-slate-400">
            {excluded} {excluded === 1 ? "item fora" : "itens fora"} do patrimônio
          </p>
        )}
      </div>
      {/* Seis colunas só quando há largura: em 1024px sobravam 102px por número
          e os valores saíam cortados. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <p className="truncate text-xs text-slate-400" title={stat.hint}>
              {stat.label}
            </p>
            {/* O valor nunca trunca — é o dado, não a decoração. */}
            <p
              className={`font-semibold whitespace-nowrap ${
                stat.value < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-white"
              } ${stat.emphasis ? "text-lg 2xl:text-xl" : "text-base"}`}
            >
              {formatCurrency(stat.value)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
