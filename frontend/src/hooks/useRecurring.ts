import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  recurringApi,
  type LaunchRecurringInput,
  type RecurringInput,
} from "../api/recurring"

export function useRecurring() {
  return useQuery({ queryKey: ["recurring"], queryFn: recurringApi.list })
}

export function useRecurringMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["budgets"] })
    queryClient.invalidateQueries({ queryKey: ["playlists"] })
  }

  const create = useMutation({
    mutationFn: (data: RecurringInput) => recurringApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RecurringInput> }) =>
      recurringApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => recurringApi.remove(id),
    onSuccess: invalidate,
  })
  const generate = useMutation({
    mutationFn: () => recurringApi.generate(),
    onSuccess: invalidate,
  })

  const launch = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LaunchRecurringInput }) =>
      recurringApi.launch(id, data),
    onSuccess: invalidate,
  })

  const postpone = useMutation({
    mutationFn: ({ id, until }: { id: number; until: string | null }) => recurringApi.postpone(id, until),
    onSuccess: invalidate,
  })

  return { create, update, remove, generate, launch, postpone }
}
