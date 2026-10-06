import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import { getAssetOutstanding } from "../../lib/asset"
import type { AssetSummary, Playlist } from "../../types"

export function AssetsOverview({
  assets,
  summary,
}: {
  assets: Playlist[]
  summary: AssetSummary
}) {
  if (assets.length === 0) return null

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Ativos (empréstimos, investimentos, obra)
        </h3>
        <Link
          to="/ativos"
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Ver todos
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-400">Total aportado</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {formatCurrency(summary.total_invested)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Total recebido</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.total_returned)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">
            {summary.total_outstanding < 0 ? "Lucro realizado" : "Em aberto"}
          </p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {formatCurrency(Math.abs(summary.total_outstanding))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => {
          const { outstanding, isProfit, isLiability, profit } = getAssetOutstanding(asset)
          return (
            <Link
              key={asset.id}
              to={`/ativos/${asset.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${asset.color}20` }}
              >
                {asset.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                  {asset.name}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    isProfit
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isLiability
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-900 dark:text-white"
                  }`}
                >
                  {formatCurrency(isProfit ? profit : outstanding)}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
