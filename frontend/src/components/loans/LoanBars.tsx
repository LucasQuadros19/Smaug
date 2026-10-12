import type { ReactNode } from "react"
import clsx from "clsx"
import { formatCurrency } from "../../lib/format"
import { seriesColor } from "../../lib/chartTheme"
import { useTheme } from "../../context/ThemeContext"

type Person = { name: string; contributed: number; gain: number; commission: number; is_me: boolean }
type Slice = { key: string; label: string; value: number; color: string }

const COMMISSION_COLOR = { light: "#8b80a6", dark: "#a197bd" }

function Bar({ title, slices }: { title: string; slices: Slice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return null
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px] text-slate-400">
        <span>{title}</span>
        <span>{formatCurrency(total)} · 100%</span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
        {slices
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${formatCurrency(s.value)} (${Math.round((s.value / total) * 100)}%)`}
              style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
              className="min-w-1 first:rounded-l-full last:rounded-r-full"
              aria-hidden
            />
          ))}
      </div>
    </div>
  )
}

/**
 * Duas barras de 100%: quem emprestou quanto e quem ganha quanto por mês. A
 * comissão é uma fatia à parte (roxo acinzentado) na barra do ganho.
 */
export function LoanBars({ people }: { people: Person[] }) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const commissionColor = isDark ? COMMISSION_COLOR.dark : COMMISSION_COLOR.light

  const named = people.filter((p) => p.name.trim())
  const colored = named.map((p, i) => ({ ...p, color: seriesColor(i, isDark) }))
  const lent = colored.reduce((sum, p) => sum + p.contributed, 0)
  const monthly = colored.reduce((sum, p) => sum + p.gain + p.commission, 0)
  const percent = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "")

  const hasCommission = colored.some((p) => p.commission > 0)
  // Uma pessoa só e sem comissão: as barras seriam 100% inteiras, não dizem nada.
  if ((lent <= 0 && monthly <= 0) || (colored.length < 2 && !hasCommission)) return null

  return (
    <div className="space-y-3">
      <Bar
        title="Quem emprestou"
        slices={colored.map((p, i) => ({ key: `l${i}`, label: p.name, value: p.contributed, color: p.color }))}
      />
      <Bar
        title="Quem ganha por mês"
        slices={[
          ...colored.map((p, i) => ({ key: `r${i}`, label: p.name, value: p.gain, color: p.color })),
          ...colored.map((p, i) => ({ key: `c${i}`, label: `Comissão · ${p.name}`, value: p.commission, color: commissionColor })),
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1.5 text-sm">
        <span className="text-[11px] text-slate-400">Pessoa</span>
        <span className="text-right text-[11px] text-slate-400">Emprestou</span>
        <span className="text-right text-[11px] text-slate-400">Ganha/mês</span>
        {colored.map((p, i) => (p.contributed <= 0 && p.gain <= 0 ? null : (
          <PersonRow key={i} color={p.color} name={p.name} isMe={p.is_me}>
            <Amount value={p.contributed} share={percent(p.contributed, lent)} />
            <Amount value={p.gain} share={percent(p.gain, monthly)} accent="text-emerald-600 dark:text-emerald-400" />
          </PersonRow>
        )))}
        {colored
          .filter((p) => p.commission > 0)
          .map((p, i) => (
            <PersonRow key={`c${i}`} color={commissionColor} name={`Comissão · ${p.name}`} isMe={p.is_me}>
              <span />
              <Amount value={p.commission} share={percent(p.commission, monthly)} accent="text-[#7a6f96] dark:text-[#b3a9cf]" />
            </PersonRow>
          ))}
      </div>
    </div>
  )
}

function PersonRow({ color, name, isMe, children }: { color: string; name: string; isMe: boolean; children: ReactNode }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <span className={clsx("truncate", isMe ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300")}>
          {name}
        </span>
      </span>
      {children}
    </>
  )
}

function Amount({ value, share, accent }: { value: number; share: string; accent?: string }) {
  return (
    <span className="text-right whitespace-nowrap">
      <span className={clsx("font-medium", accent ?? "text-slate-700 dark:text-slate-200")}>{formatCurrency(value)}</span>
      {share && <span className="ml-1.5 text-xs text-slate-400">{share}</span>}
    </span>
  )
}
