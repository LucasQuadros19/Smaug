import { api } from "./client"
import type { Loan, LoanStatus } from "../types"

export type LoanParticipantInput = {
  name: string
  contributed: number
  to_receive: number
  is_me: boolean
}

export type LoanInput = {
  borrower: string
  amount: number
  interest_rate?: number | null
  commission_rate?: number | null
  start_date: string
  due_date?: string | null
  status: LoanStatus
  notes?: string | null
  participants: LoanParticipantInput[]
}

export type RepaymentInput = {
  date: string
  amount: number
  my_share: number
  partners_share: number
  account_id: number
  partners_settled?: boolean
  notes?: string | null
}

export const loansApi = {
  addRepayment: (loanId: number, data: RepaymentInput) =>
    api.post<Loan>(`/loans/${loanId}/repayments`, data),
  settlePartners: (loanId: number, repaymentId: number, accountId?: number) =>
    api
      .post<Loan>(`/loans/${loanId}/repayments/${repaymentId}/settle-partners`, {
        account_id: accountId,
      }),
  removeRepayment: (loanId: number, repaymentId: number) =>
    api.delete<Loan>(`/loans/${loanId}/repayments/${repaymentId}`),
  list: () => api.get<Loan[]>("/loans"),
  create: (data: LoanInput) => api.post<Loan>("/loans", data),
  update: (id: number, data: Partial<LoanInput>) =>
    api.put<Loan>(`/loans/${id}`, data),
  remove: (id: number) => api.delete(`/loans/${id}`),
}
