import { formatMonthLabel } from "./format"
import type { Granularity } from "../types"

/**
 * Paleta categórica validada (dataviz): ordem fixa, nunca ciclada.
 * Checks de banda de luminosidade, croma, separação CVD e contraste passam
 * nos dois modos — ver scripts/validate_palette.js.
 */
export const CATEGORICAL_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
]

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
]

export function categoricalPalette(isDark: boolean) {
  return isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
}

/** Cor do slot `index`, sem gerar hues novos: a partir do 7º item, cinza. */
export function seriesColor(index: number, isDark: boolean) {
  const palette = categoricalPalette(isDark)
  return palette[index] ?? (isDark ? "#8a8a85" : "#6f6e69")
}

export const AXIS_COLOR = "#94a3b8"
export const GRID_COLOR = "#94a3b8"

/** Receita/despesa: polaridade, reforçada pela posição acima/abaixo do zero. */
export const POSITIVE = "#22c55e"
export const NEGATIVE = "#f43f5e"

/** "2026-08" (mês) vs "2026-08-25" (semana ou data de registro). */
function isDay(period: string) {
  return period.split("-").length === 3
}

export function formatPeriodLabel(period: string, granularity: Granularity): string {
  if (isDay(period)) {
    const [year, month, day] = period.split("-")
    return granularity === "weekly" ? `${day}/${month}` : `${month}/${year.slice(2)}`
  }
  return formatMonthLabel(period).split(" ")[0].slice(0, 3)
}

export function formatPeriodFull(period: string, granularity: Granularity): string {
  if (isDay(period)) {
    const [year, month, day] = period.split("-")
    return granularity === "weekly"
      ? `Semana de ${day}/${month}/${year}`
      : `${day}/${month}/${year}`
  }
  return formatMonthLabel(period)
}
