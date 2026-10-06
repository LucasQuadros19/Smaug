import type { ShoppingPriority } from "../types"

export const PRIORITY_LABELS: Record<ShoppingPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
}

export const PRIORITY_STYLES: Record<ShoppingPriority, { active: string; badge: string; dot: string }> = {
  high: {
    active: "bg-rose-500 text-white",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  medium: {
    active: "bg-amber-500 text-white",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  low: {
    active: "bg-slate-500 text-white",
    badge: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
    dot: "bg-slate-400",
  },
}
