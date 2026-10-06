import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { transactionsApi, type TransactionFilters, type TransactionInput } from "../api/transactions"

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => transactionsApi.list(filters),
    placeholderData: (previous) => previous,
  })
}

export function useTransactionMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["budgets"] })
    queryClient.invalidateQueries({ queryKey: ["playlists"] })
  }

  const create = useMutation({
    mutationFn: (data: TransactionInput) => transactionsApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TransactionInput> }) =>
      transactionsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => transactionsApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
