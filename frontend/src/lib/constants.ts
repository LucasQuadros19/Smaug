import type { AssetType } from "../types"
import type { AccountType, Currency, RecurringFrequency } from "../types"

export const CURRENCIES: Record<Currency, string> = {
  BRL: "Real (R$)",
  USD: "Dólar (US$)",
  EUR: "Euro (€)",
  BTC: "Bitcoin (BTC)",
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
  investment: "Investimento",
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
}

export const COMMON_ICONS = [
  "💰",
  "🍔",
  "🚗",
  "🏠",
  "🎮",
  "💊",
  "📚",
  "🧾",
  "💼",
  "📈",
  "✈️",
  "🐾",
  "🏍️",
  "🪙",
  "🤝",
  "🎯",
  "🛠️",
  "🎁",
]

export const COLOR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
]

/**
 * Tipos de ativo. O `mode` decide o que um lançamento faz com o valor:
 * "capital" — o valor É o dinheiro aplicado (aportar aumenta, receber diminui);
 * "declarado" — o valor é uma cotação sua e os lançamentos são custos reais.
 */
export const ASSET_TYPES = {
  investment: { label: "Investimento", icon: "📈", mode: "capital", hint: "Cripto, ações, bot" },
  loan: { label: "Empréstimo", icon: "🤝", mode: "capital", hint: "Dinheiro emprestado a alguém" },
  construction: { label: "Construção", icon: "🏗️", mode: "capital", hint: "Capital em obra" },
  debt: { label: "Dívida", icon: "📉", mode: "capital", hint: "O que você deve" },
  vehicle: { label: "Veículo", icon: "🏍️", mode: "declarado", hint: "Vale a FIPE; gastos são gastos" },
  property: { label: "Imóvel", icon: "🏠", mode: "declarado", hint: "Vale a avaliação; gastos são gastos" },
  other: { label: "Outro", icon: "📦", mode: "capital", hint: "Qualquer outra coisa" },
} as const satisfies Record<AssetType, { label: string; icon: string; mode: string; hint: string }>
