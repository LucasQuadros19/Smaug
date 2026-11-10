import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { categoriesApi, type CategoryInput } from "../api/categories"
import type { Category, CategoryType } from "../types"

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

  // A lista muda na hora; cada lista em cache troca só os lugares das categorias reordenadas.
  const reorder = useMutation({
    mutationFn: (ids: number[]) => categoriesApi.reorder(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      const rank = new Map(ids.map((id, i) => [id, i]))
      queryClient.setQueriesData<Category[]>({ queryKey: ["categories"] }, (list) => {
        if (!list) return list
        const moved = list.filter((c) => rank.has(c.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
        let next = 0
        return list.map((c) => (rank.has(c.id) ? moved[next++] : c))
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })

  return { create, update, remove, reorder }
}
