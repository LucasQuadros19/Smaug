import clsx from "clsx"
import { AlertTriangle, ChevronRight, Info, OctagonAlert, X } from "lucide-react"
import { Link } from "react-router-dom"
import { useAlertActions } from "../../hooks/useDashboard"
import type { Alert } from "../../types"

const STYLES = {
  danger: { icon: OctagonAlert, className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300" },
  warning: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300" },
  info: { icon: Info, className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300" },
}

/** O que pede atenção agora. Some quando não há nada — sem "tudo certo" ocupando espaço. */
export function AlertsPanel({ alerts, hidden }: { alerts: Alert[]; hidden: number }) {
  const { dismiss, restore, restoring } = useAlertActions()
  if (alerts.length === 0 && hidden === 0) return null

  return (
    <div className="space-y-2">
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {alerts.map((alert) => {
            const { icon: Icon, className } = STYLES[alert.level]
            return (
              <div key={alert.key} className={clsx("flex items-center rounded-xl border", className)}>
                <Link
                  to={alert.link}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 transition-opacity hover:opacity-80"
                >
                  <Icon size={18} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{alert.title}</p>
                    <p className="truncate text-xs opacity-80">{alert.detail}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 opacity-60" />
                </Link>
                <button
                  type="button"
                  onClick={() => dismiss(alert.key)}
                  aria-label={`Esconder o aviso: ${alert.title}`}
                  title="Esconder este aviso"
                  className="mr-2 shrink-0 rounded-lg p-1.5 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {hidden > 0 && (
        <p className="text-xs text-slate-400">
          {hidden} {hidden === 1 ? "aviso escondido" : "avisos escondidos"} ·{" "}
          <button
            type="button"
            onClick={() => restore()}
            disabled={restoring}
            className="font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
          >
            mostrar de novo
          </button>
        </p>
      )}
    </div>
  )
}
