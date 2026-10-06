import { api } from "./client"
import type { Category } from "../types"

export type CategoryInput = {
  name: string
  type: Category["type"]
  color: string
  icon: string
}

export const categoriesApi = {
  list: (type?: Category["type"]) =>
    api.get<Category[]>("/categories", { params: type ? { type } : undefined }),
  create: (data: CategoryInput) => api.post<Category>("/categories", data),
  update: (id: number, data: Partial<CategoryInput>) =>
    api.put<Category>(`/categories/${id}`, data),
  remove: (id: number) => api.delete(`/categories/${id}`),
}
