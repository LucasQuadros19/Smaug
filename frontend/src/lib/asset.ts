import type { Playlist } from "../types"

/**
 * Quanto ainda está parado neste ativo/playlist: o que já era seu
 * (opening_value) + o que saiu do caixa para cá − o que já voltou.
 * Se o retorno passou do aportado, a diferença vira lucro realizado.
 */
export function getAssetOutstanding(playlist: Playlist) {
  const opening = playlist.opening_value ?? 0
  // Em valor declarado (veículo, imóvel) os lançamentos são custos: o valor é
  // só o que foi declarado. Abastecer não deixa a moto mais cara.
  const calculado =
    playlist.value_mode === "declarado"
      ? opening
      : opening + (playlist.total_out ?? 0) - (playlist.total_in ?? 0)
  const outstanding = playlist.outstanding ?? calculado

  // Negativo tem dois significados diferentes: uma posição declarada negativa
  // é passivo (dívida); uma que ficou negativa porque voltou mais do que saiu
  // é lucro já realizado.
  const isLiability = opening < 0
  const isProfit = !isLiability && outstanding < 0

  return {
    outstanding,
    isLiability,
    isProfit,
    profit: isProfit ? Math.abs(outstanding) : 0,
  }
}

/** Soma só os passivos (dívidas declaradas), como número negativo. */
export function sumLiabilities(playlists: Playlist[]): number {
  return playlists.reduce((sum, p) => {
    const { outstanding, isLiability } = getAssetOutstanding(p)
    return sum + (isLiability ? outstanding : 0)
  }, 0)
}

/** Total aportado: o que já era seu mais o que saiu do caixa para cá. */
export function getTotalInvested(playlist: Playlist): number {
  if (playlist.value_mode === "declarado") return playlist.opening_value ?? 0
  return (playlist.opening_value ?? 0) + (playlist.total_out ?? 0)
}

/** Valor declarado por você (FIPE, avaliação) em vez de somado dos lançamentos. */
export function isDeclaredValue(playlist: Playlist): boolean {
  return playlist.value_mode === "declarado"
}
