import { api } from "./client"
import type { Goal } from "../types"

export type GoalInput = {
  name: string
  icon: string
  target_amount: number
  deadline: string | null
  /** null = acompanha o patrimônio total */
  playlist_id: number | null
}

export const goalsApi = {
  list: () => api.get<Goal[]>("/goals"),
  create: (data: GoalInput) => api.post<Goal>("/goals", data),
  update: (id: number, data: Partial<GoalInput>) => api.put<Goal>(`/goals/${id}`, data),
  remove: (id: number) => api.delete(`/goals/${id}`),
}
