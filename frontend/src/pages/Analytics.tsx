import { useState } from "react"
import clsx from "clsx"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Input, Select } from "../components/ui/Input"
import { SegmentedControl } from "../components/ui/SegmentedControl"
import { CategoryBreakdownPanel } from "../components/transactions/CategoryBreakdownPanel"
import { LeftoverChart, type LeftoverPoint } from "../components/analytics/LeftoverChart"
import { CategoryPeriodChart } from "../components/analytics/CategoryPeriodChart"
import { WeekdayChart } from "../components/analytics/WeekdayChart"
import { useAnalytics, useSetLeftover } from "../hooks/useTransactions"
import { useSettings } from "../hooks/useMe"
import { formatCurrency, formatDate, formatMonthLabel, isoDate, shiftMonth, todayISO } from "../lib/format"
import { analyticsPeriod } from "../lib/chartTheme"
import type { Analytics as AnalyticsData, AnalyticsGranularity, CategoryBreakdown } from "../types"

const UNIT: Record<AnalyticsGranularity, [string, string]> = {
  day: ["dia", "dias"],
  week: ["semana", "semanas"],
  month: ["mês", "meses"],
  year: ["ano", "anos"],
}

/** O ano que a tela de meses mostra: com o mês começando no dia 24, 28/12 já é do ano seguinte. */
function shownYear(ref: string, data?: AnalyticsData) {
  return data?.granularity === "month" ? data.periods[0].period.slice(0, 4) : ref.slice(0, 4)
}

/** Anda a janela para trás (-1) ou para frente (1): um mês de dias, 13 semanas ou um ano de meses. */
function shiftRef(ref: string, granularity: AnalyticsGranularity, step: number, data?: AnalyticsData) {
  if (granularity === "day") return `${shiftMonth(ref.slice(0, 7), step)}-01`
  if (granularity === "week") {
    const [y, m, d] = ref.split("-").map(Number)
    return isoDate(new Date(y, m - 1, d + 91 * step))
  }
  // Meio do ano: cai no ano certo seja qual for o dia em que o mês começa.
  return `${Number(shownYear(ref, data)) + step}-06-15`
}

function windowLabel(ref: string, granularity: AnalyticsGranularity, data?: AnalyticsData) {
  if (granularity === "day") return formatMonthLabel(ref.slice(0, 7))
  if (granularity === "month") return shownYear(ref, data)
  if (granularity === "year") return "Todos os anos"
  return data ? `${formatDate(data.start).slice(0, 5)} a ${formatDate(data.end)}` : "13 semanas"
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "bad" }) {
  return (
    <Card className="min-w-0 p-4">
      <p className="truncate text-xs text-slate-400">{label}</p>
      <p
        className={clsx(
          "mt-1 whitespace-nowrap text-lg font-semibold",
          tone === "bad" ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </p>
      {detail && <p className="mt-0.5 text-xs text-slate-400">{detail}</p>}
    </Card>
  )
}

/** Sobra digitada (olhando o banco): vazio + Salvar apaga. O mês é o selecionado no gráfico. */
function InformLeftover({
  points,
  month,
  onMonthChange,
}: {
  points: LeftoverPoint[]
  month: string
  onMonthChange: (month: string) => void
}) {
  const save = useSetLeftover()
  const point = points.find((p) => p.period === month)
  const today = todayISO()

  return (
    <form
      key={`${month}:${point?.informed}`}
      onSubmit={(e) => {
        e.preventDefault()
        const raw = String(new FormData(e.currentTarget).get("amount") ?? "").trim()
        save.mutate({ month, amount: raw === "" ? null : Number(raw) })
      }}
      className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-white/5"
    >
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Sobra informada de</span>
      <Select
        aria-label="Mês da sobra"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        className="w-auto!"
      >
        {points
          .filter((p) => p.start <= today)
          .map((p) => (
            <option key={p.period} value={p.period}>
              {analyticsPeriod(p.period, "month", p)}
            </option>
          ))}
      </Select>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
        <Input
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          aria-label="Quanto sobrou"
          defaultValue={point?.informed ?? ""}
          placeholder={point ? formatCurrency(point.leftover).replace("R$", "").trim() : ""}
          className="w-36! pl-9"
        />
      </div>
      <Button type="submit" disabled={save.isPending}>
        Salvar
      </Button>
      <p className="w-full text-xs text-slate-400">
        Quanto sobrou de verdade (olhando o banco). Pode ser negativo; deixe vazio e salve para apagar.
        {point && ` A calculada pelos lançamentos foi ${formatCurrency(point.leftover)}.`}
      </p>
    </form>
  )
}

export function Analytics() {
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("month")
  const [ref, setRef] = useState(todayISO())
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>()
  const { settings, set: setSettings } = useSettings()
  const monthStart = settings.month_start_day ?? 1
  const { data, isFetching } = useAnalytics(granularity, ref, monthStart)
  const today = todayISO()

  const changeWindow = (nextGranularity: AnalyticsGranularity, nextRef: string) => {
    setGranularity(nextGranularity)
    setRef(nextRef)
    setSelectedPeriod(null)
  }
  const togglePeriod = (period: string) => setSelectedPeriod((current) => (current === period ? null : period))

  const periods = data?.periods ?? []
  const points = periods.reduce<LeftoverPoint[]>((acc, p) => {
    const leftover = p.income - p.expense
    return [...acc, { ...p, leftover, accumulated: (acc.at(-1)?.accumulated ?? 0) + leftover }]
  }, [])
  const income = periods.reduce((sum, p) => sum + p.income, 0)
  const expense = periods.reduce((sum, p) => sum + p.expense, 0)
  const elapsed = Math.max(periods.filter((p) => p.start <= today).length, 1)
  const peak = periods.reduce<(typeof periods)[number] | null>(
    (best, p) => (p.expense > (best?.expense ?? 0) ? p : best),
    null
  )

  // A chave "0" é o que ficou sem categoria, como vem do servidor.
  const byKey = new Map((data?.categories ?? []).map((c) => [String(c.category_id ?? 0), c]))
  const peakCategory = peak
    ? byKey.get(Object.entries(peak.categories).sort((a, b) => b[1].total - a[1].total)[0]?.[0] ?? "")
    : undefined
  const period = periods.find((p) => p.period === selectedPeriod)
  const panelItems: CategoryBreakdown[] = period
    ? Object.entries(period.categories)
        .map(([key, totals]) => ({ ...byKey.get(key)!, ...totals }))
        .sort((a, b) => b.total - a.total)
    : (data?.categories ?? [])
  const panelPeriod = period
    ? `em ${analyticsPeriod(period.period, granularity, period).toLowerCase()}`
    : granularity === "year"
      ? "em todos os anos"
      : `em ${windowLabel(ref, granularity, data).toLowerCase()}`
  const atEnd = !data || data.end >= today
  const informedTotal = periods.reduce<number | null>(
    (sum, p) => (p.informed === null ? sum : (sum ?? 0) + p.informed),
    null
  )
  const hasInformed = informedTotal !== null
  const informMonth =
    selectedPeriod ?? [...periods].reverse().find((p) => p.start <= today)?.period ?? periods[0]?.period
  const [unit, units] = UNIT[granularity]

  return (
    <>
      <Topbar title="Análises" />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            ariaLabel="Ver por"
            value={granularity}
            onChange={(next) => changeWindow(next, todayISO())}
            options={[
              { value: "day", label: "Dia" },
              { value: "week", label: "Semana" },
              { value: "month", label: "Mês" },
              { value: "year", label: "Ano" },
            ]}
          />
          <div className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 dark:border-white/10 dark:bg-white/5">
            {granularity !== "year" && (
              <button
                type="button"
                aria-label="Período anterior"
                onClick={() => changeWindow(granularity, shiftRef(ref, granularity, -1, data))}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <span className="min-w-[140px] px-2 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
              {windowLabel(ref, granularity, data)}
            </span>
            {granularity !== "year" && (
              <button
                type="button"
                aria-label="Próximo período"
                disabled={atEnd}
                onClick={() => changeWindow(granularity, shiftRef(ref, granularity, 1, data))}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-white/10"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
          {(granularity === "month" || granularity === "year") && (
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Meu mês começa no dia
              <Select
                value={monthStart}
                onChange={(e) => {
                  setSelectedPeriod(null)
                  setSettings({ month_start_day: Number(e.target.value) })
                }}
                className="w-auto! py-1.5!"
                title="Recebe no dia 24 e conta como dinheiro do mês seguinte? Escolha 24: dezembro vai de 24/11 a 23/12."
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {period && (
            <button
              type="button"
              onClick={() => setSelectedPeriod(null)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
            >
              {analyticsPeriod(period.period, granularity, period)}
              <X size={14} aria-label="Tirar a seleção" />
            </button>
          )}
        </div>

        {!data ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className={clsx("space-y-6 transition-opacity", isFetching && "opacity-60")}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="Entrou" value={formatCurrency(income)} />
              <Stat label="Saiu" value={formatCurrency(expense)} />
              <Stat
                label="Sobrou"
                value={formatCurrency(income - expense)}
                tone={income - expense < 0 ? "bad" : undefined}
                detail={[
                  income > 0 ? `${Math.round(((income - expense) / income) * 100)}% do que entrou` : null,
                  informedTotal !== null ? `informada: ${formatCurrency(informedTotal)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined}
              />
              <Stat
                label={`Gasto médio por ${unit}`}
                value={formatCurrency(expense / elapsed)}
                detail={`em ${elapsed} ${elapsed === 1 ? unit : units}`}
              />
              <Stat
                label={`${unit[0].toUpperCase()}${unit.slice(1)} que mais gastou`}
                value={peak ? formatCurrency(peak.expense) : "—"}
                detail={
                  peak
                    ? `${analyticsPeriod(peak.period, granularity, peak)}${peakCategory ? ` · mais em ${peakCategory.icon} ${peakCategory.name}` : ""}`
                    : "Sem gastos"
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <LeftoverChart
                points={points}
                granularity={granularity}
                selected={selectedPeriod}
                onSelect={togglePeriod}
                footer={
                  granularity === "month" && informMonth ? (
                    <InformLeftover points={points} month={informMonth} onMonthChange={setSelectedPeriod} />
                  ) : undefined
                }
              />
              <WeekdayChart weekdays={data.weekdays} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <CategoryPeriodChart
                periods={periods}
                categories={data.categories}
                granularity={granularity}
                selectedPeriod={selectedPeriod}
                selectedCategory={selectedCategory}
                onSelectPeriod={togglePeriod}
              />
              {panelItems.length > 0 ? (
                <CategoryBreakdownPanel
                  items={panelItems}
                  period={panelPeriod}
                  selectedId={selectedCategory}
                  onSelect={setSelectedCategory}
                />
              ) : (
                <Card className="flex items-center justify-center text-sm text-slate-400">Sem gastos {panelPeriod}</Card>
              )}
            </div>

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">No que mais gastou</h3>
                <p className="mb-2 mt-1 text-xs text-slate-400">Lançamentos com a mesma descrição somados</p>
                {data.top_descriptions.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem gastos neste período</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-white/5">
                    {data.top_descriptions.map((t) => (
                      <li key={t.description} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                          {t.icon} {t.description}
                          <span className="ml-1.5 text-xs text-slate-400">{t.count}x</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-slate-800 dark:text-slate-100">
                          {formatCurrency(t.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Ver tudo em tabela
                  </summary>
                  <div className="mt-3 max-h-96 overflow-auto">
                    <table className="w-full text-sm tabular-nums">
                      <thead className="sticky top-0 bg-white text-xs text-slate-400 dark:bg-[#12141b]">
                        <tr>
                          <th className="py-1.5 text-left font-medium">Período</th>
                          <th className="py-1.5 text-right font-medium">Entrou</th>
                          <th className="py-1.5 text-right font-medium">Saiu</th>
                          <th className="py-1.5 text-right font-medium">Sobrou</th>
                          {hasInformed && <th className="py-1.5 text-right font-medium">Informada</th>}
                          <th className="py-1.5 text-right font-medium">Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {points.map((p) => (
                          <tr key={p.period} className="text-slate-700 dark:text-slate-200">
                            <td className="py-1.5 pr-3">{analyticsPeriod(p.period, granularity, p)}</td>
                            <td className="py-1.5 text-right">{formatCurrency(p.income)}</td>
                            <td className="py-1.5 text-right">{formatCurrency(p.expense)}</td>
                            <td className={clsx("py-1.5 text-right", p.leftover < 0 && "text-rose-600 dark:text-rose-400")}>
                              {formatCurrency(p.leftover)}
                            </td>
                            {hasInformed && (
                              <td className="py-1.5 text-right">{p.informed === null ? "—" : formatCurrency(p.informed)}</td>
                            )}
                            <td className={clsx("py-1.5 text-right", p.accumulated < 0 && "text-rose-600 dark:text-rose-400")}>
                              {formatCurrency(p.accumulated)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Card>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
