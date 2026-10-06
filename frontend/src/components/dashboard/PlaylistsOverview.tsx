import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { formatCurrency } from "../../lib/format"
import { getAssetOutstanding } from "../../lib/asset"
import type { Playlist } from "../../types"

export function PlaylistsOverview({ playlists }: { playlists: Playlist[] }) {
  if (playlists.length === 0) return null

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Grupos</h3>
        <Link
          to="/grupos"
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Ver todas
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((playlist) => {
          const { outstanding, isProfit, profit } = getAssetOutstanding(playlist)
          return (
            <Link
              key={playlist.id}
              to={`/grupos/${playlist.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${playlist.color}20` }}
              >
                {playlist.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                  {playlist.name}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    isProfit
                      ? "text-emerald-600 dark:text-emerald-400"
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
