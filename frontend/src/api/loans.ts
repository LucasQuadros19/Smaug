import { api } from "./client"
import type { Loan, LoanSchedule, LoanStatus } from "../types"

export type LoanParticipantInput = {
  name: string
  contributed: number
  /** Por mês. */
  gain: number
  commission: number
  is_me: boolean
}

export type LoanInput = {
  borrower: string
  amount: number
  interest_rate?: number | null
  months: number
  schedule: LoanSchedule
  start_date: string
  due_date?: string | null
  status: LoanStatus
  notes?: string | null
  participants: LoanParticipantInput[]
  /** A saída da minha conta quando emprestei; null apaga. */
  outflow?: { account_id: number; amount: number; date?: string } | null
}

export type RepaymentPart = {
  kind: "principal" | "interest" | "fee"
  amount: number
  my_share: number
  partners_share: number
}

export type RepaymentInput = {
  date: string
  account_id: number
  parts: RepaymentPart[]
  partners_settled?: boolean
  /** Empurra o vencimento: o empréstimo continua para o próximo mês. */
  next_due_date?: string | null
  notes?: string | null
}

export type PostponeInput = {
  due_date: string
  /** O mês vence mesmo assim e os juros ficam pendentes. Sem isso é carência. */
  charge_interest: boolean
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
  postpone: (loanId: number, data: PostponeInput) => api.post<Loan>(`/loans/${loanId}/postpone`, data),
  undoEvent: (loanId: number, eventId: number) => api.delete<Loan>(`/loans/${loanId}/events/${eventId}`),
  removeRepayment: (loanId: number, repaymentId: number) =>
    api.delete<Loan>(`/loans/${loanId}/repayments/${repaymentId}`),
  list: () => api.get<Loan[]>("/loans"),
  create: (data: LoanInput) => api.post<Loan>("/loans", data),
  update: (id: number, data: Partial<LoanInput>) =>
    api.put<Loan>(`/loans/${id}`, data),
  /** `keepCash`: os lançamentos ficam no caixa como lançamentos comuns (o saldo não muda). */
  remove: (id: number, keepCash: boolean) => api.delete(`/loans/${id}${keepCash ? "?keep_cash=1" : ""}`),
}
