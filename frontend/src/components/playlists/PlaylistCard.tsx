import { Pencil, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { formatCurrency, formatMoney, formatRate } from "../../lib/format"
import { getAssetOutstanding, getTotalInvested, isDeclaredValue } from "../../lib/asset"
import { ASSET_TYPES } from "../../lib/constants"
import type { Playlist } from "../../types"

export function PlaylistCard({
  playlist,
  onEdit,
  onDelete,
}: {
  playlist: Playlist
  onEdit: () => void
  onDelete: () => void
}) {
  const isAsset = playlist.kind === "asset"
  const { outstanding, isProfit, isLiability, profit } = getAssetOutstanding(playlist)
  const foreign = playlist.currency !== "BRL"
  const detailPath = isAsset ? `/ativos/${playlist.id}` : `/grupos/${playlist.id}`

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <Link to={detailPath} className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ backgroundColor: `${playlist.color}20` }}
          >
            {playlist.icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-slate-900 hover:underline dark:text-white">
                {playlist.name}
              </p>
              {isAsset && (
                <Badge color="#f59e0b">
                  {ASSET_TYPES[playlist.asset_type]?.label ?? "Ativo"}
                </Badge>
              )}
              {!playlist.counts_in_net_worth && <Badge color="#64748b">Fora do patrimônio</Badge>}
              {playlist.auto_source === "loans" && <Badge color="#2a78d6">Vem dos Empréstimos</Badge>}
            </div>
            {playlist.description && (
              <p className="truncate text-xs text-slate-400">{playlist.description}</p>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-400">
          {isProfit
            ? "Lucro realizado"
            : isLiability
              ? "Dívida"
              : isDeclaredValue(playlist)
                ? "Valor de mercado"
                : isAsset
                  ? "Em aberto"
                  : "Valor parado aqui"}
        </p>
        <p
          className={`text-2xl font-semibold ${
            isProfit
              ? "text-emerald-600 dark:text-emerald-400"
              : isLiability
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-900 dark:text-white"
          }`}
        >
          {foreign ? formatMoney(playlist.native_value, playlist.currency) : formatCurrency(isProfit ? profit : outstanding)}
        </p>
        {foreign && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {playlist.rate
              ? `≈ ${formatCurrency(outstanding)} · 1 ${playlist.currency} = ${formatRate(playlist.rate)}`
              : "sem cotação no momento"}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {isDeclaredValue(playlist) ? (
            <>
              <span>Já gastei: {formatCurrency(playlist.total_out ?? 0)}</span>
              <span>Já rendeu: {formatCurrency(playlist.total_in ?? 0)}</span>
            </>
          ) : (
            <>
              <span>Aportado: {formatCurrency(getTotalInvested(playlist))}</span>
              <span>Recebido: {formatCurrency(playlist.total_in ?? 0)}</span>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
