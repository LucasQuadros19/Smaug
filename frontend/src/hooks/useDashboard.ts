import { useQuery } from "@tanstack/react-query"
import { dashboardApi } from "../api/dashboard"
import type { Granularity } from "../types"

/** Cotações em reais, renovadas a cada minuto. */
export function useRates() {
  return useQuery({ queryKey: ["rates"], queryFn: dashboardApi.rates, refetchInterval: 60_000 })
}

export function useDashboard(month: string, granularity: Granularity = "monthly") {
  return useQuery({
    queryKey: ["dashboard", month, granularity],
    queryFn: () => dashboardApi.summary(month, granularity),
    placeholderData: (previous) => previous,
    // Posições em dólar/bitcoin mudam com a cotação: o backend renova a cada minuto.
    refetchInterval: 60_000,
  })
}

/** Só os totais — sem séries nem composição. Para telas que mostram o resumo
 *  no topo sem desenhar gráfico. */
export function useDashboardSummary(month: string) {
  return useQuery({
    queryKey: ["dashboard", month, "compact"],
    queryFn: () => dashboardApi.summary(month, "monthly", true),
    placeholderData: (previous) => previous,
  })
}
