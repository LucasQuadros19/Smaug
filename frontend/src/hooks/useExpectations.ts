import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  expectationsApi,
  type ExpectationInput,
  type LaunchExpectationInput,
} from "../api/expectations"

export function useExpectations(filters: { playlist_id?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ["expectations", filters],
    queryFn: () => expectationsApi.list(filters),
  })
}

export function useExpectationMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["expectations"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["playlists"] })
    queryClient.invalidateQueries({ queryKey: ["budgets"] })
  }

  const create = useMutation({
    mutationFn: (data: ExpectationInput) => expectationsApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExpectationInput> }) =>
      expectationsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => expectationsApi.remove(id),
    onSuccess: invalidate,
  })
  const launch = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LaunchExpectationInput }) =>
      expectationsApi.launch(id, data),
    onSuccess: invalidate,
  })

  return { create, update, remove, launch }
}
