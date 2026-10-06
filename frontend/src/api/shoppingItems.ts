import { api } from "./client"
import type { ShoppingItem, ShoppingPriority } from "../types"

export type ShoppingItemInput = {
  description: string
  amount?: number | null
  playlist_id?: number | null
  priority?: ShoppingPriority
  notes?: string | null
}

export const shoppingItemsApi = {
  list: (playlistId?: number) =>
    api
      .get<ShoppingItem[]>("/shopping-items", { params: playlistId ? { playlist_id: playlistId } : undefined }),
  create: (data: ShoppingItemInput) =>
    api.post<ShoppingItem>("/shopping-items", data),
  update: (id: number, data: Partial<ShoppingItemInput & { purchased: boolean }>) =>
    api.put<ShoppingItem>(`/shopping-items/${id}`, data),
  remove: (id: number) => api.delete(`/shopping-items/${id}`),
}
