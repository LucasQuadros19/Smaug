import { api } from "./client"
import type { Account } from "../types"

export type AccountInput = {
  name: string
  type: Account["type"]
  initial_balance: number
  color: string
}

export const accountsApi = {
  list: () => api.get<Account[]>("/accounts"),
  create: (data: AccountInput) => api.post<Account>("/accounts", data),
  update: (id: number, data: Partial<AccountInput>) =>
    api.put<Account>(`/accounts/${id}`, data),
  remove: (id: number) => api.delete(`/accounts/${id}`),
}
