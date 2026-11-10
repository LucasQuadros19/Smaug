import { formatDate, formatMonthLabel, isoDate } from "./format"
import type { AnalyticsGranularity, Granularity } from "../types"

/**
 * Paleta categórica validada (dataviz): ordem fixa, nunca ciclada.
 * Checks de banda de luminosidade, croma, separação CVD e contraste passam
 * nos dois modos — ver scripts/validate_palette.js.
 */
const CATEGORICAL_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
]

const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
]

/** Cor do slot `index`, sem gerar hues novos: a partir do 7º item, cinza. */
export function seriesColor(index: number, isDark: boolean) {
  return (isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT)[index] ?? (isDark ? "#8a8a85" : "#6f6e69")
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

/** Fresta entre barras empilhadas: a cor do fundo do card. */
export function surfaceColor(isDark: boolean) {
  return isDark ? "#12141b" : "#ffffff"
}

export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

function dayParts(period: string) {
  const [year, month, day] = period.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/** Rótulo curto no eixo da tela de Análises. */
export function analyticsTick(period: string, granularity: AnalyticsGranularity): string {
  if (granularity === "day") return period.slice(8)
  if (granularity === "week") return formatDate(period).slice(0, 5)
  if (granularity === "month") return formatMonthLabel(period).slice(0, 3)
  return period
}

/** Mês (ou ano) que começa noutro dia, como o salário do dia 24: mostra as datas de verdade. */
function shiftedRange(range: { start: string; end: string } | undefined, firstDay: string, full: boolean) {
  if (!range || range.start.endsWith(firstDay)) return ""
  const show = (day: string) => (full ? formatDate(day) : formatDate(day).slice(0, 5))
  return ` (${show(range.start)} a ${show(range.end)})`
}

/** O período por extenso: "Segunda, 10/11/2026", "03/11 a 09/11/2026", "Novembro de 2026", "2026".
 *  Com `range`, mês e ano que não começam no dia 1 ganham as datas: "Dezembro de 2026 (24/11 a 23/12)". */
export function analyticsPeriod(
  period: string,
  granularity: AnalyticsGranularity,
  range?: { start: string; end: string }
): string {
  if (granularity === "day") return `${WEEKDAYS[(dayParts(period).getDay() + 6) % 7]}, ${formatDate(period)}`
  if (granularity === "week") {
    const start = dayParts(period)
    const end = isoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))
    return `${formatDate(period).slice(0, 5)} a ${formatDate(end)}`
  }
  if (granularity === "month") return formatMonthLabel(period) + shiftedRange(range, "-01", false)
  return period + shiftedRange(range, "-01-01", true)
}
