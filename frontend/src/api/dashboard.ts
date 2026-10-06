import { api } from "./client"
import type { DashboardSummary, Granularity, Rates } from "../types"

export const dashboardApi = {
  rates: () => api.get<Rates>("/rates"),
  summary: (month: string, granularity: Granularity = "monthly", compact = false) =>
    api
      .get<DashboardSummary>("/dashboard/summary", {
        params: { month, granularity, ...(compact ? { compact: 1 } : {}) },
      }),
}
