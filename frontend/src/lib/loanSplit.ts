export type SplitParticipant = {
  name: string
  contributed: number
  to_receive: number
  is_me: boolean
}

const cents = (v: number) => Math.round(v * 100) / 100

/**
 * Divide o que a pessoa vai devolver entre quem entrou com dinheiro.
 *
 * Lucro = devolvido − emprestado. Primeiro sai a comissão (% do lucro, minha);
 * o resto do lucro vai para cada um na proporção do que colocou. Sem linha
 * "eu" e com comissão, cria uma com R$ 0 — é o caso de emprestar dinheiro só
 * de outros.
 */
export function splitLoan(
  participants: SplitParticipant[],
  totalBack: number,
  commissionRate: number
): SplitParticipant[] {
  const contributed = participants.reduce((s, p) => s + (p.contributed || 0), 0)
  const profit = Math.max(totalBack - contributed, 0)
  const commission = cents((profit * commissionRate) / 100)
  const rest = profit - commission

  const list =
    commissionRate > 0 && !participants.some((p) => p.is_me)
      ? [...participants, { name: "Eu", contributed: 0, to_receive: 0, is_me: true }]
      : participants
  // A comissão vai para a primeira linha "eu" (normalmente só existe uma).
  const meIndex = list.findIndex((p) => p.is_me)

  return list.map((p, i) => {
    const share = contributed > 0 ? (rest * (p.contributed || 0)) / contributed : 0
    return {
      ...p,
      to_receive: cents((p.contributed || 0) + share + (i === meIndex ? commission : 0)),
    }
  })
}
