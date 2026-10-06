import { Link } from "react-router-dom"
import { Card } from "../ui/Card"
import { GoalProgress } from "../goals/GoalProgress"
import type { Goal } from "../../types"

export function GoalsOverview({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return null

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Metas</h3>
        <Link to="/metas" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Ver todas
        </Link>
      </div>
      <div className="space-y-4">
        {goals.map((goal) => (
          <GoalProgress key={goal.id} goal={goal} />
        ))}
      </div>
    </Card>
  )
}
