import type { Transaction } from "../types"

/**
 * Transações tagueadas a uma playlist/ativo são movimentação de patrimônio
 * (dinheiro mudando de forma), não ganho ou perda real — por isso usam uma
 * cor neutra em vez do verde/vermelho de receita/despesa.
 */
export function getAmountColorClass(tx: Transaction): string {
  if (tx.playlist) {
    return "text-indigo-600 dark:text-indigo-400"
  }
  return tx.type === "income"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400"
}
