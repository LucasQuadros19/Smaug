import { api } from "./client"
import type { Sheet } from "../types"

export const sheetsApi = {
  list: () => api.get<Sheet[]>("/sheets"),
  create: (title?: string) => api.post<Sheet>("/sheets", title ? { title } : {}),
  update: (id: number, data: Partial<Pick<Sheet, "title" | "content">>) =>
    api.put<Sheet>(`/sheets/${id}`, data),
  remove: (id: number) => api.delete(`/sheets/${id}`),
}
