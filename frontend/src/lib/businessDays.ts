/**
 * Calendário bancário brasileiro (o mesmo do Fozesc): fim de semana e feriado
 * nacional não são dia útil. Só cálculo de data — nada de juros nem valor.
 */

// 24 e 31/12 entram porque não há expediente bancário, mesmo sem ser feriado oficial.
const FIXED: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-24": "Véspera de Natal",
  "12-25": "Natal",
  "12-31": "Véspera de Ano Novo",
}

/** Páscoa pelo algoritmo de Meeus/Butcher. Dela saem Carnaval, Sexta-feira Santa e Corpus Christi. */
function easter(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day, 12))
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

const cache = new Map<number, Record<string, string>>()

function holidaysOf(year: number) {
  const hit = cache.get(year)
  if (hit) return hit
  const map: Record<string, string> = {}
  for (const [mmdd, name] of Object.entries(FIXED)) map[`${year}-${mmdd}`] = name
  const e = easter(year)
  // Bancos fecham segunda e terça de Carnaval; a quarta de cinzas compensa normal.
  map[iso(plusDays(e, -48))] = "Carnaval"
  map[iso(plusDays(e, -47))] = "Carnaval"
  map[iso(plusDays(e, -2))] = "Sexta-feira Santa"
  map[iso(plusDays(e, 60))] = "Corpus Christi"
  cache.set(year, map)
  return map
}

/** Nome do feriado nacional no dia, ou null. */
export function holidayName(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return holidaysOf(Number(day.slice(0, 4)))[day] ?? null
}

/** Por que não é dia útil ("Sábado", "Domingo" ou o feriado); null quando é. */
export function notBusinessReason(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [y, m, d] = day.split("-").map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  if (weekday === 0) return "Domingo"
  if (weekday === 6) return "Sábado"
  return holidayName(day)
}

/** O primeiro dia útil a partir da data (ela mesma, se já for). */
export function nextBusinessDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  let current = new Date(Date.UTC(y, m - 1, d, 12))
  // Nenhum feriado brasileiro emenda mais que alguns dias seguidos.
  for (let i = 0; i < 10; i++) {
    if (!notBusinessReason(iso(current))) return iso(current)
    current = plusDays(current, 1)
  }
  return day
}
