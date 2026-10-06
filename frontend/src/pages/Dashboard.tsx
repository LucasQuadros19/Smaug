import { useState } from "react"
import { Topbar } from "../components/layout/Topbar"
import { MonthSwitcher } from "../components/ui/MonthSwitcher"
import { BalanceCards } from "../components/dashboard/BalanceCards"
import { WealthOverview } from "../components/dashboard/WealthOverview"
import { CashflowChart } from "../components/dashboard/CashflowChart"
import { CategoryPieChart } from "../components/dashboard/CategoryPieChart"
import { NetWorthChart } from "../components/dashboard/NetWorthChart"
import { AllocationChart } from "../components/dashboard/AllocationChart"
import { BudgetProgress } from "../components/dashboard/BudgetProgress"
import { RecentTransactions } from "../components/dashboard/RecentTransactions"
import { AccountsOverview } from "../components/dashboard/AccountsOverview"
import { PlaylistsOverview } from "../components/dashboard/PlaylistsOverview"
import { AssetsOverview } from "../components/dashboard/AssetsOverview"
import { UpcomingExpectations } from "../components/dashboard/UpcomingExpectations"
import { AlertsPanel } from "../components/dashboard/AlertsPanel"
import { GoalsOverview } from "../components/dashboard/GoalsOverview"
import { useDashboard } from "../hooks/useDashboard"
import { currentMonth } from "../lib/format"
import { sumLiabilities } from "../lib/asset"
import type { Granularity } from "../types"

export function Dashboard() {
  const [month, setMonth] = useState(currentMonth())
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const { data, isLoading } = useDashboard(month, granularity)

  return (
    <>
      <Topbar title="Dashboard" action={<MonthSwitcher month={month} onChange={setMonth} />} />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {isLoading || !data ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <>
            <AlertsPanel alerts={data.alerts} />

            <BalanceCards
              netWorth={data.net_worth}
              cashBalance={data.total_balance}
              parkedInAssets={data.parked_in_assets}
              parkedInPlaylists={data.parked_in_playlists}
              monthIncome={data.month_income}
              monthExpense={data.month_expense}
              monthSavings={data.month_savings}
              previousMonth={data.previous_month}
            />

            <WealthOverview summary={data} />

            <GoalsOverview goals={data.goals} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <CashflowChart
                data={data.cashflow_series ?? []}
                granularity={granularity}
                onGranularityChange={setGranularity}
              />
              <CategoryPieChart data={data.expenses_by_category} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <NetWorthChart
                data={data.net_worth_series ?? { series: [], assets: [] }}
                granularity={granularity}
              />
              <AllocationChart
                allocation={data.allocation ?? []}
                liabilities={sumLiabilities(data.playlists_summary)}
              />
            </div>

            <AccountsOverview accounts={data.accounts_balance} />
            <AssetsOverview
              assets={data.playlists_summary.filter((p) => p.kind === "asset")}
              summary={data.asset_summary}
            />
            <UpcomingExpectations expectations={data.upcoming_expectations} />
            <PlaylistsOverview
              playlists={data.playlists_summary.filter((p) => p.kind === "group")}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <BudgetProgress budgets={data.budgets_progress} />
              <RecentTransactions transactions={data.recent_transactions} />
            </div>
          </>
        )}
      </main>
    </>
  )
}
