import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  loansApi,
  type LoanInput,
  type PostponeInput,
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
    mutationFn: ({ id, keepCash }: { id: number; keepCash: boolean }) => loansApi.remove(id, keepCash),
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

  const postpone = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PostponeInput }) => loansApi.postpone(id, data),
    onSuccess: invalidate,
  })
  const undoEvent = useMutation({
    mutationFn: ({ id, eventId }: { id: number; eventId: number }) => loansApi.undoEvent(id, eventId),
    onSuccess: invalidate,
  })

  return { create, update, remove, addRepayment, settlePartners, removeRepayment, postpone, undoEvent }
}
