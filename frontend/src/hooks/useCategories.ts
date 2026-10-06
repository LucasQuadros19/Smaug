import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { categoriesApi, type CategoryInput } from "../api/categories"
import type { CategoryType } from "../types"

export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: ["categories", type ?? "all"],
    queryFn: () => categoriesApi.list(type),
  })
}

export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["budgets"] })
  }

  const create = useMutation({
    mutationFn: (data: CategoryInput) => categoriesApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoryInput> }) =>
      categoriesApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
