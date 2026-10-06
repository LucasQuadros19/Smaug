import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { snapshotsApi, type SnapshotInput, type TransferInput, type SettleInput, type InvestInput } from "../api/snapshots"

export function useSnapshots(params: { page?: number; per_page?: number } = {}) {
  return useQuery({
    queryKey: ["snapshots", params],
    queryFn: () => snapshotsApi.list(params),
    // Mantém a tabela na tela enquanto a página seguinte carrega.
    placeholderData: (previous) => previous,
  })
}

export function useSnapshotMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["snapshots"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["playlists"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
  }

  const create = useMutation({
    mutationFn: (data: SnapshotInput) => snapshotsApi.create(data),
    onSuccess: invalidate,
  })
  const transfer = useMutation({
    mutationFn: (data: TransferInput) => snapshotsApi.transfer(data),
    onSuccess: invalidate,
  })
  const settle = useMutation({
    mutationFn: (data: SettleInput) => snapshotsApi.settle(data),
    onSuccess: invalidate,
  })
  const invest = useMutation({
    mutationFn: (data: InvestInput) => snapshotsApi.invest(data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => snapshotsApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, transfer, settle, invest, remove }
}
