import { api } from "./client"
import type {
  BotAccounts,
  BotCatalog,
  BotClosedTrade,
  BotLog,
  BotRobot,
  BotRobotInput,
  BotSimulationInput,
  BotSimulationResult,
} from "../types"

export const botApi = {
  catalog: () => api.get<BotCatalog>("/bot/estrategias"),
  simulate: (data: BotSimulationInput) =>
    api.post<BotSimulationResult>(data.moedas ? "/bot/backtest/carteira" : "/bot/backtest", data),
  accounts: () => api.get<BotAccounts>("/bot/contas"),
  robots: () => api.get<BotRobot[]>("/bot/robos"),
  createRobot: (data: BotRobotInput) => api.post<BotRobot>("/bot/robos", data),
  updateRobot: (id: string, data: BotRobotInput) => api.put<BotRobot>(`/bot/robos/${id}`, data),
  removeRobot: (id: string) => api.delete(`/bot/robos/${id}`),
  start: (id: string) => api.post<BotRobot>(`/bot/robos/${id}/ligar`),
  stop: (id: string) => api.post<BotRobot>(`/bot/robos/${id}/desligar`),
  logs: (id: string) => api.get<BotLog[]>(`/bot/robos/${id}/logs`, { params: { limite: 100 } }),
  trades: (id: string) => api.get<BotClosedTrade[]>(`/bot/robos/${id}/operacoes`),
}
