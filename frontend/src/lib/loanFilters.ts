import { todayISO } from "./format"
import type { Loan } from "../types"

export type LoanFilter = "open" | "late" | "paid" | "all"

/** Atrasado: marcado assim, ou com o vencimento já passado e ainda em aberto. */
export function isLate(loan: Loan) {
  return loan.status === "late" || (loan.status !== "paid" && !!loan.due_date && loan.due_date < todayISO())
}

export function matchesFilter(loan: Loan, filter: LoanFilter) {
  if (filter === "open") return loan.status !== "paid"
  if (filter === "late") return isLate(loan)
  if (filter === "paid") return loan.status === "paid"
  return true
}
