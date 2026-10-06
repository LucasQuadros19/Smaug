const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

const rateFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

/** Cotação: com 2 casas o dólar a 4,9988 vira "R$ 5,00". */
export function formatRate(value: number): string {
  return rateFormatter.format(value)
}

/** Valor na moeda da posição. BTC com 8 casas: 0,05 BTC precisa aparecer. */
export function formatMoney(value: number, currency: string = "BRL"): string {
  if (currency === "BRL") return formatCurrency(value)
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "BTC" ? 8 : 2,
  }).format(value)
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number)
  const date = new Date(year, m - 1, 1)
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** "YYYY-MM-DD" no fuso de quem usa. toISOString() é UTC: depois das 21h no Brasil já é amanhã. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function todayISO(): string {
  return isoDate(new Date())
}
