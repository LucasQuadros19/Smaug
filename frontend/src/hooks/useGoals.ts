import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { goalsApi, type GoalInput } from "../api/goals"

export function useGoals() {
  // O progresso acompanha o patrimônio, que muda com a cotação.
  return useQuery({ queryKey: ["goals"], queryFn: goalsApi.list, refetchInterval: 60_000 })
}

export function useGoalMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["goals"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const create = useMutation({ mutationFn: (data: GoalInput) => goalsApi.create(data), onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GoalInput> }) => goalsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: number) => goalsApi.remove(id), onSuccess: invalidate })

  return { create, update, remove }
}
