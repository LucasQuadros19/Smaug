import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { accountsApi, type AccountInput } from "../api/accounts"

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: () => accountsApi.list() })
}

/** Saldo de cada conta no fim do dia `date`. */
export function useAccountsAt(date: string) {
  return useQuery({ queryKey: ["accounts", "as_of", date], queryFn: () => accountsApi.list(date), enabled: Boolean(date) })
}

export function useAccountMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const create = useMutation({
    mutationFn: (data: AccountInput) => accountsApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AccountInput> }) =>
      accountsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => accountsApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
