import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { authApi } from "../api/auth"
import { dashboardApi } from "../api/dashboard"
import type { DashboardSummary, Granularity } from "../types"

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

/** O X de um aviso some com ele na hora; "mostrar" traz de volta todos os escondidos. */
export function useAlertActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ["dashboard"] })
  const dismiss = useMutation({
    mutationFn: authApi.dismissAlert,
    onMutate: async (key: string) => {
      // Uma atualização a caminho traria o aviso de volta antes de o servidor gravar.
      await client.cancelQueries({ queryKey: ["dashboard"] })
      client.setQueriesData<DashboardSummary>({ queryKey: ["dashboard"] }, (data) =>
        data && {
          ...data,
          alerts: data.alerts.filter((alert) => alert.key !== key),
          alerts_hidden: data.alerts_hidden + 1,
        }
      )
    },
    onSettled: refresh,
  })
  const restore = useMutation({ mutationFn: authApi.restoreAlerts, onSettled: refresh })
  return { dismiss: dismiss.mutate, restore: restore.mutate, restoring: restore.isPending }
}
