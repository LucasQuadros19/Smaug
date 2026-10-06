import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { formatCurrency, formatDate } from "../../lib/format"
import type { PlaylistExpectation } from "../../types"

export function UpcomingExpectations({
  expectations,
}: {
  expectations: PlaylistExpectation[]
}) {
  if (expectations.length === 0) return null

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Próximos recebimentos
      </h3>
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {expectations.map((exp) => (
          <li key={exp.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <Link
              to={`/ativos/${exp.playlist.id}`}
              className="flex min-w-0 items-center gap-3 hover:underline"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${exp.playlist.color}20` }}
              >
                {exp.playlist.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {exp.description}
                </p>
                <p
                  className={`text-xs ${
                    exp.is_overdue ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                  }`}
                >
                  {exp.is_overdue ? "Atrasado desde " : "Esperado em "}
                  {formatDate(exp.expected_date)}
                </p>
              </div>
            </Link>
            <span className="shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {formatCurrency(exp.amount)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
