import { api } from "./client"
import type { Transaction, TransactionPage, TransactionScope } from "../types"

export type TransactionInput = {
  description: string
  account_id: number
  category_id: number | null
  playlist_id?: number | null
  amount: number
  type: Transaction["type"]
  date: string
  notes?: string | null
}

export type TransactionFilters = {
  account_id?: number
  category_id?: number
  playlist_id?: number
  type?: Transaction["type"]
  start_date?: string
  end_date?: string
  search?: string
  scope?: TransactionScope
  page?: number
  per_page?: number
}

export const transactionsApi = {
  list: (filters: TransactionFilters = {}) =>
    api.get<TransactionPage>("/transactions", { params: filters }),
  create: (data: TransactionInput) =>
    api.post<Transaction>("/transactions", data),
  update: (id: number, data: Partial<TransactionInput>) =>
    api.put<Transaction>(`/transactions/${id}`, data),
  remove: (id: number) => api.delete(`/transactions/${id}`),
}
