import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  loansApi,
  type LoanInput,
  type RepaymentInput,
} from "../api/loans"

export function useLoans() {
  return useQuery({ queryKey: ["loans"], queryFn: loansApi.list })
}

export function useLoanMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["loans"] })
    // Quitar mexe em caixa, posição e patrimônio.
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["playlists"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  const create = useMutation({
    mutationFn: (data: LoanInput) => loansApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LoanInput> }) =>
      loansApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => loansApi.remove(id),
    onSuccess: invalidate,
  })


  const addRepayment = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RepaymentInput }) =>
      loansApi.addRepayment(id, data),
    onSuccess: invalidate,
  })
  const settlePartners = useMutation({
    mutationFn: ({ id, repaymentId }: { id: number; repaymentId: number }) =>
      loansApi.settlePartners(id, repaymentId),
    onSuccess: invalidate,
  })
  const removeRepayment = useMutation({
    mutationFn: ({ id, repaymentId }: { id: number; repaymentId: number }) =>
      loansApi.removeRepayment(id, repaymentId),
    onSuccess: invalidate,
  })

  return { create, update, remove, addRepayment, settlePartners, removeRepayment }
}
