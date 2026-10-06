import { api } from "./client"
import type { RecurringTransaction, Transaction } from "../types"

export type RecurringInput = {
  description: string
  account_id: number
  category_id: number | null
  playlist_id?: number | null
  amount: number
  type: RecurringTransaction["type"]
  frequency: RecurringTransaction["frequency"]
  next_due_date: string
  active?: boolean
  auto?: boolean
}

export type LaunchRecurringInput = {
  amount?: number
  date?: string
  notes?: string | null
}

export const recurringApi = {
  list: () => api.get<RecurringTransaction[]>("/recurring"),
  create: (data: RecurringInput) =>
    api.post<RecurringTransaction>("/recurring", data),
  update: (id: number, data: Partial<RecurringInput>) =>
    api.put<RecurringTransaction>(`/recurring/${id}`, data),
  remove: (id: number) => api.delete(`/recurring/${id}`),
  postpone: (id: number, until: string | null) =>
    api.post<RecurringTransaction>(`/recurring/${id}/postpone`, { until }),
  generate: () => api.post<{ generated: number }>("/recurring/generate"),
  launch: (id: number, data: LaunchRecurringInput) =>
    api
      .post<{ recurring: RecurringTransaction; transaction: Transaction }>(
        `/recurring/${id}/launch`,
        data
      ),
}
