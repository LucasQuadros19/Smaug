import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { BudgetBar } from "../budgets/BudgetBar"
import type { Budget } from "../../types"

export function BudgetProgress({ budgets }: { budgets: Budget[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Orçamentos do mês
        </h3>
        <Link
          to="/orcamentos"
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Ver todos
        </Link>
      </div>
      {budgets.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nenhum orçamento definido para este mês
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => (
            <BudgetBar key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </Card>
  )
}
