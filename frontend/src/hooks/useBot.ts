import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { botApi } from "../api/bot"
import type { BotRobotInput } from "../types"

// Bot fora do ar responde 502: uma tentativa a mais basta, senão a tela demora para avisar.
const retry = 1

export function useBotCatalog() {
  return useQuery({ queryKey: ["bot", "catalog"], queryFn: botApi.catalog, staleTime: Infinity, retry })
}

export function useBotAccounts() {
  return useQuery({ queryKey: ["bot", "accounts"], queryFn: botApi.accounts, refetchInterval: 30_000, retry })
}

export function useRobots() {
  return useQuery({ queryKey: ["bot", "robots"], queryFn: botApi.robots, refetchInterval: 10_000, retry })
}

export function useRobotLogs(id: string, enabled: boolean) {
  return useQuery({ queryKey: ["bot", "logs", id], queryFn: () => botApi.logs(id), refetchInterval: 5_000, enabled, retry })
}

export function useRobotTrades(id: string, enabled: boolean) {
  return useQuery({ queryKey: ["bot", "trades", id], queryFn: () => botApi.trades(id), staleTime: 60_000, enabled, retry })
}

export function useSimulation() {
  return useMutation({ mutationFn: botApi.simulate })
}

export function useRobotMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["bot", "robots"] })
    queryClient.invalidateQueries({ queryKey: ["bot", "accounts"] })
  }
  return {
    create: useMutation({ mutationFn: (data: BotRobotInput) => botApi.createRobot(data), onSuccess }),
    update: useMutation({ mutationFn: ({ id, data }: { id: string; data: BotRobotInput }) => botApi.updateRobot(id, data), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => botApi.removeRobot(id), onSuccess }),
    start: useMutation({ mutationFn: (id: string) => botApi.start(id), onSuccess }),
    stop: useMutation({ mutationFn: (id: string) => botApi.stop(id), onSuccess }),
  }
}
