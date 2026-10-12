export const cents = (value: number) => Math.round(value * 100) / 100

/**
 * Completa os campos em branco (null) com o que falta para chegar ao total.
 *
 * Os digitados ficam como estão; o resto é dividido entre os em branco, pelo
 * peso de cada um (ex: o que cada um emprestou) ou em partes iguais. Se os
 * digitados já passam do total, os em branco ficam com zero.
 */
export function fillRemainder(manual: (number | null)[], total: number, weights?: number[]): number[] {
  const fixed = manual.reduce<number>((sum, v) => sum + (v ?? 0), 0)
  const blanks = manual.flatMap((v, i) => (v === null ? [i] : []))
  const rest = Math.max(cents(total - fixed), 0)
  const w = blanks.map((i) => Math.max(weights?.[i] ?? 1, 0))
  const wSum = w.reduce((a, b) => a + b, 0)

  const result = manual.map((v) => v ?? 0)
  let given = 0
  blanks.forEach((i, k) => {
    const share = wSum > 0 ? w[k] / wSum : 1 / blanks.length
    // O último leva o arredondamento: a soma fecha certinho no total.
    const value = k === blanks.length - 1 ? cents(rest - given) : cents(rest * share)
    result[i] = value
    given = cents(given + value)
  })
  return result
}
