import clsx from "clsx"
import { AlertTriangle, ChevronRight, Info, OctagonAlert } from "lucide-react"
import { Link } from "react-router-dom"
import type { Alert } from "../../types"

const STYLES = {
  danger: { icon: OctagonAlert, className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300" },
  warning: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300" },
  info: { icon: Info, className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300" },
}

/** O que pede atenção agora. Some quando não há nada — sem "tudo certo" ocupando espaço. */
export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {alerts.map((alert, i) => {
        const { icon: Icon, className } = STYLES[alert.level]
        return (
          <Link
            key={i}
            to={alert.link}
            className={clsx("flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity hover:opacity-80", className)}
          >
            <Icon size={18} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{alert.title}</p>
              <p className="truncate text-xs opacity-80">{alert.detail}</p>
            </div>
            <ChevronRight size={16} className="shrink-0 opacity-60" />
          </Link>
        )
      })}
    </div>
  )
}
