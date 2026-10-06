import { api } from "./client"
import type { Budget } from "../types"

export type BudgetInput = {
  category_id: number
  month: string
  limit_amount: number
}

export const budgetsApi = {
  list: (month: string) => api.get<Budget[]>("/budgets", { params: { month } }),
  create: (data: BudgetInput) => api.post<Budget>("/budgets", data),
  update: (id: number, data: Partial<BudgetInput>) =>
    api.put<Budget>(`/budgets/${id}`, data),
  remove: (id: number) => api.delete(`/budgets/${id}`),
}
