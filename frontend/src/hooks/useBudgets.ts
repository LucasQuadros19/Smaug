import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { budgetsApi, type BudgetInput } from "../api/budgets"

export function useBudgets(month: string) {
  return useQuery({ queryKey: ["budgets", month], queryFn: () => budgetsApi.list(month) })
}

export function useBudgetMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const create = useMutation({
    mutationFn: (data: BudgetInput) => budgetsApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BudgetInput> }) =>
      budgetsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => budgetsApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
