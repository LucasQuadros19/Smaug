import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import clsx from "clsx"
import { Bot, Coins, Pencil, Play, Sparkles, Trash2 } from "lucide-react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { useConfirm } from "../ui/ConfirmDialog"
import { Input, Label, Select } from "../ui/Input"
import { ConfigFields } from "./ConfigFields"
import { useTheme } from "../../context/ThemeContext"
import { botApi } from "../../api/bot"
import { useSimulation } from "../../hooks/useBot"
import { useRates } from "../../hooks/useDashboard"
import {
  DEFAULT_CONFIG,
  PERIODS,
  bestIndex,
  chipClasses,
  clampDays,
  coin,
  maxDays,
  mergeCurves,
  periodName,
  portfolioConfig,
  runName,
  sizingText,
  strategyText,
  timeframeName,
} from "../../lib/bot"
import { AXIS_COLOR, GRID_COLOR, seriesColor } from "../../lib/chartTheme"
import { formatMoney, isoDate, todayISO } from "../../lib/format"
import { toast } from "../../lib/toast"
import type { BotCatalog, BotConfig, BotSimulationInput, BotSimulationResult, BotSimulationSummary } from "../../types"

type Run = { id: number; slot: number; config: BotSimulationInput; result: BotSimulationResult }

const STORAGE_KEY = "bot-simulacoes"
/** Uma cor da paleta para cada: a sétima entra no lugar da mais antiga. */
const MAX_RUNS = 6

function readRuns(): Run[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Run[]) : []
  } catch {
    return []
  }
}

function saveRuns(runs: Run[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  } catch {
    // sem armazenamento (aba anônima): as simulações valem só enquanto a tela está aberta
  }
}

const p = (ema_rapida: number, ema_lenta: number, qtd_velas_stop: number, risco_retorno: number) => ({
  ema_rapida,
  ema_lenta,
  qtd_velas_stop,
  risco_retorno,
})
const demo = (config: Partial<BotSimulationInput>): BotSimulationInput => ({
  estrategia: "long_short",
  cripto: "BTCUSDT",
  tempo_grafico: "60",
  compra: null,
  venda: null,
  alavancagem: 1,
  risco_pct: 1,
  dias: 1095,
  capital: 1000,
  ...config,
})
/** Seis configurações da avaliação de out/2026, todas nos últimos 3 anos com 1.000 USDT. */
const DEMO: BotSimulationInput[] = [
  demo({ compra: p(10, 12, 13, 2.9) }),
  demo({ cripto: "SOLUSDT", compra: p(10, 12, 13, 2.9) }),
  demo({ compra: p(5, 45, 13, 1.7) }),
  demo({ estrategia: "compra", cripto: "ETHUSDT", compra: p(5, 15, 17, 4.1) }),
  demo({ estrategia: "venda", venda: p(9, 21, 17, 3.5) }),
  demo({ cripto: "SOLUSDT", tempo_grafico: "15", compra: p(5, 45, 13, 1.7), risco_pct: null }),
]

const usd = (value: number) => formatMoney(value, "USD")
const pct = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
const plain = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
const day = (t: number) => new Date(t).toLocaleDateString("pt-BR")
const tone = (value: number) =>
  value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"

const METRICS: {
  label: string
  hint?: string
  value: (s: BotSimulationSummary) => number | null
  format: (value: number) => string
  better?: "higher" | "lower"
}[] = [
  { label: "Retorno", value: (s) => s.retorno_pct, format: pct, better: "higher" },
  { label: "Só comprar e segurar", hint: "A moeda (na carteira, a média delas) no mesmo período", value: (s) => s.buy_hold_pct, format: pct },
  { label: "Maior queda", hint: "Do pico do saldo até o fundo seguinte", value: (s) => s.max_queda_pct, format: pct, better: "higher" },
  { label: "Operações", value: (s) => s.operacoes, format: plain },
  { label: "Acerto", value: (s) => s.acerto_pct, format: (v) => `${plain(v)}%`, better: "higher" },
  { label: "Fator de lucro", hint: "Ganhos ÷ perdas: acima de 1 ganhou", value: (s) => s.fator_lucro, format: plain, better: "higher" },
  { label: "Média por operação", hint: "Em R: 1R é o que se perde num stop", value: (s) => s.media_r, format: (v) => `${plain(v)} R`, better: "higher" },
  { label: "Maior sequência de perdas", value: (s) => s.maior_seq_perdas, format: plain, better: "lower" },
  { label: "Taxas pagas", value: (s) => s.taxas, format: usd, better: "lower" },
  { label: "Tempo posicionado", value: (s) => s.exposicao_pct, format: (v) => `${plain(v)}%` },
  { label: "Saldo final", value: (s) => s.final, format: usd, better: "higher" },
]

function RunTitle({ run, catalog, align = "left" }: { run: Run; catalog: BotCatalog; align?: "left" | "right" }) {
  const { theme } = useTheme()
  const { config } = run
  return (
    <div className={clsx("min-w-0", align === "right" && "text-right")}>
      <p className={clsx("flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100", align === "right" && "justify-end")}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seriesColor(run.slot, theme === "dark") }} />
        {runName(config)} · {timeframeName(config.tempo_grafico, catalog)}
      </p>
      <p className="text-xs font-normal text-slate-500 dark:text-slate-400">{strategyText(config, catalog)}</p>
      <p className="text-[11px] font-normal text-slate-400">
        {sizingText(config)} · {periodName(config)}
      </p>
    </div>
  )
}

function ComparisonChart({ runs, catalog }: { runs: Run[]; catalog: BotCatalog }) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const data = useMemo(
    () => mergeCurves(runs.map((r) => ({ capital: r.result.resumo.capital, points: r.result.curva }))),
    [runs]
  )
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeOpacity={0.15} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t) => new Date(t).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis tickFormatter={(v) => `${v}%`} stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} width={52} />
        <ReferenceLine y={0} stroke={AXIS_COLOR} strokeDasharray="3 3" />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
                <p className="mb-1 text-slate-500 dark:text-slate-400">{day(label as number)}</p>
                {payload.map((entry) => {
                  const run = runs[Number(String(entry.dataKey).slice(1))]
                  return (
                    <p key={String(entry.dataKey)} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      {runName(run.config)} {timeframeName(run.config.tempo_grafico, catalog)}
                      <span className={clsx("ml-auto font-medium", tone(entry.value as number))}>{pct(entry.value as number)}</span>
                    </p>
                  )
                })}
              </div>
            ) : null
          }
        />
        {runs.map((run, i) => (
          <Line
            key={run.id}
            dataKey={`s${i}`}
            stroke={seriesColor(run.slot, isDark)}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function MetricsTable({ runs, catalog }: { runs: Run[]; catalog: BotCatalog }) {
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 dark:border-white/5">
          <th className="px-4 py-3 text-left align-bottom text-xs font-medium text-slate-400">Lado a lado</th>
          {runs.map((run) => (
            <th key={run.id} className="px-4 py-3 align-bottom">
              <RunTitle run={run} catalog={catalog} align="right" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
        {METRICS.map((metric) => {
          const values = runs.map((run) => metric.value(run.result.resumo))
          const best = metric.better ? bestIndex(values, metric.better) : -1
          return (
            <tr key={metric.label}>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                {metric.label}
                {metric.hint && <span className="block text-[11px] text-slate-400">{metric.hint}</span>}
              </td>
              {values.map((value, i) => (
                <td
                  key={runs[i].id}
                  className={clsx(
                    "px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200",
                    i === best && "font-semibold text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {value == null ? "—" : metric.format(value)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MiniChart({ run }: { run: Run }) {
  const { theme } = useTheme()
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={run.result.curva} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
        <YAxis domain={["auto", "auto"]} hide />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#161923]">
                <p className="mb-1 text-slate-500 dark:text-slate-400">{day(label as number)}</p>
                {payload.map((entry) => (
                  <p key={String(entry.dataKey)} className="text-slate-700 dark:text-slate-200">
                    {entry.dataKey === "v" ? "Estratégia" : "Só segurando"}: {usd(entry.value as number)}
                  </p>
                ))}
              </div>
            ) : null
          }
        />
        <Line dataKey="bh" stroke={AXIS_COLOR} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line dataKey="v" stroke={seriesColor(run.slot, theme === "dark")} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function RunCard({
  run,
  catalog,
  onEdit,
  onUse,
  onRemove,
}: {
  run: Run
  catalog: BotCatalog
  onEdit: () => void
  onUse: () => void
  onRemove: () => void
}) {
  const { resumo, operacoes, total_operacoes } = run.result
  return (
    <Card className="min-w-0 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <RunTitle run={run} catalog={catalog} />
        <button
          onClick={onRemove}
          aria-label="Remover simulação"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/5"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className={clsx("text-2xl font-semibold", tone(resumo.retorno_pct))}>{pct(resumo.retorno_pct)}</p>
        <p className="text-right text-xs text-slate-400">
          só segurando <span className={tone(resumo.buy_hold_pct)}>{pct(resumo.buy_hold_pct)}</span>
          <span className="block">
            {day(resumo.inicio)} a {day(resumo.fim)}
          </span>
        </p>
      </div>
      {resumo.quebrou && (
        <p className="rounded-lg bg-rose-500/10 px-2 py-1 text-xs text-rose-600 dark:text-rose-400">O saldo zerou: a simulação parou aí.</p>
      )}
      {(resumo.puladas ?? 0) > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
          {plain(resumo.puladas!)} sinais pulados: o saldo não alcançava a quantidade mínima de ordem do par.
        </p>
      )}

      <MiniChart run={run} />

      <dl className="grid grid-cols-4 gap-2 text-xs">
        {[
          ["Operações", plain(resumo.operacoes)],
          ["Acerto", resumo.acerto_pct == null ? "—" : `${plain(resumo.acerto_pct)}%`],
          ["Maior queda", pct(resumo.max_queda_pct)],
          ["Fator", resumo.fator_lucro == null ? "—" : plain(resumo.fator_lucro)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-slate-400">{label}</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onEdit}>
          <Pencil size={14} /> Ajustar e simular de novo
        </Button>
        {!run.config.moedas && (
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onUse}>
            <Bot size={14} /> Usar num robô
          </Button>
        )}
      </div>

      {run.result.por_moeda && (
        <details className="text-xs" open>
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Por moeda (cada uma arriscando {plain(run.config.risco_pct ?? 0)}% do capital)
          </summary>
          <table className="mt-2 w-full">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-1 pr-2 font-medium">Moeda</th>
                <th className="py-1 pr-2 text-right font-medium">Resultado</th>
                <th className="py-1 pr-2 text-right font-medium">Segurando</th>
                <th className="py-1 pr-2 text-right font-medium">Operações</th>
                <th className="py-1 text-right font-medium">Pulados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {run.result.por_moeda.map((m) => (
                <tr key={m.cripto} className="text-slate-600 dark:text-slate-300">
                  <td className="py-1 pr-2 font-medium">{coin(m.cripto)}</td>
                  <td className={clsx("py-1 pr-2 text-right tabular-nums", tone(m.retorno_pct))}>{pct(m.retorno_pct)}</td>
                  <td className={clsx("py-1 pr-2 text-right tabular-nums", tone(m.buy_hold_pct))}>{pct(m.buy_hold_pct)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{plain(m.operacoes)}</td>
                  <td className={clsx("py-1 text-right tabular-nums", m.puladas > 0 && "text-amber-600 dark:text-amber-400")}>
                    {plain(m.puladas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {operacoes.length > 0 && (
        <details className="group text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Operações {total_operacoes > operacoes.length ? `(as ${operacoes.length} últimas de ${total_operacoes})` : `(${total_operacoes})`}
          </summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full min-w-[380px]">
              <thead className="sticky top-0 bg-white text-left text-slate-400 dark:bg-[#12141e]">
                <tr>
                  <th className="py-1 pr-2 font-medium">Entrada</th>
                  <th className="py-1 pr-2 font-medium">Lado</th>
                  <th className="py-1 pr-2 text-right font-medium">Preço</th>
                  <th className="py-1 pr-2 font-medium">Saiu no</th>
                  <th className="py-1 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {operacoes.map((op) => (
                  <tr key={`${op.cripto ?? ""}${op.entrada_em}`} className="text-slate-600 dark:text-slate-300">
                    <td className="py-1 pr-2">{day(op.entrada_em)}</td>
                    <td className="py-1 pr-2">
                      {op.cripto && `${coin(op.cripto)} · `}
                      {op.lado === "compra" ? "Compra" : "Venda"}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {plain(op.entrada)} → {plain(op.saida)}
                    </td>
                    <td className="py-1 pr-2">{op.motivo}</td>
                    <td className={clsx("py-1 text-right tabular-nums", tone(op.resultado))}>
                      {usd(op.resultado)} <span className="text-[10px]">({pct(op.resultado_pct)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Card>
  )
}

function PortfolioFields({
  value,
  onChange,
  catalog,
}: {
  value: BotSimulationInput
  onChange: (value: BotSimulationInput) => void
  catalog: BotCatalog
}) {
  const chosen = value.moedas ?? []
  const toggle = (cripto: string) =>
    onChange({
      ...value,
      moedas: chosen.includes(cripto) ? chosen.filter((m) => m !== cripto) : catalog.carteira.moedas.filter((m) => m === cripto || chosen.includes(m)),
    })
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
        Um robô por moeda na mesma subconta, todos com {strategyText(value, catalog)} no gráfico de 1 hora. Cada stop leva o risco
        escolhido do capital; o resultado é a soma de todas.
      </p>
      <div role="group" aria-label="Moedas">
        <div className="mb-1.5 flex items-baseline justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Moedas ({chosen.length})</p>
          <button
            type="button"
            onClick={() => onChange({ ...value, moedas: chosen.length ? [] : catalog.carteira.moedas })}
            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {chosen.length ? "Limpar" : "Todas"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {catalog.carteira.moedas.map((m) => (
            <button key={m} type="button" aria-pressed={chosen.includes(m)} onClick={() => toggle(m)} className={chipClasses(chosen.includes(m))}>
              {coin(m)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Com pouco capital, moedas de lote mínimo caro (BTC, ETH, SOL, SUI) pulam entradas e só pegam as de stop curto, as piores.
        </p>
      </div>
      <div className="w-1/2 pr-1.5">
        <Label htmlFor="carteira-risco">Risco por moeda (%)</Label>
        <Input
          id="carteira-risco"
          type="number"
          inputMode="decimal"
          required
          min={0.1}
          max={10}
          step={0.1}
          value={Number.isNaN(value.risco_pct) ? "" : (value.risco_pct ?? "")}
          onChange={(e) => onChange({ ...value, risco_pct: e.target.valueAsNumber })}
        />
      </div>
    </div>
  )
}

export function Simulations({ catalog, onUseInRobot }: { catalog: BotCatalog; onUseInRobot: (config: BotConfig) => void }) {
  const [form, setForm] = useState<BotSimulationInput>({ ...DEFAULT_CONFIG, dias: 365, capital: 1000 })
  const [runs, setRuns] = useState<Run[]>(readRuns)
  const simulation = useSimulation()
  const { data: rates } = useRates()
  const ask = useConfirm()
  const portfolio = form.moedas !== undefined
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => saveRuns(runs), [runs])

  const shown = [...runs].reverse()
  const periods = PERIODS.filter((p) => p.dias <= maxDays(form.tempo_grafico))
  const byDates = Boolean(form.de && form.ate) || form.de === "" || form.ate === ""

  const [demoStep, setDemoStep] = useState<number | null>(null)
  const runDemo = async () => {
    const done: Run[] = []
    try {
      for (const [i, config] of DEMO.entries()) {
        setDemoStep(i + 1)
        done.push({ id: Date.now() + i, slot: i, config, result: await botApi.simulate(config) })
      }
      setRuns(done)
    } catch (err) {
      toast((err as Error).message, "error")
    } finally {
      setDemoStep(null)
    }
  }
  const demoButton = (
    <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={runDemo} disabled={demoStep !== null}>
      <Sparkles size={14} /> {demoStep ? `Simulando ${demoStep} de ${DEMO.length}...` : "Ver demonstração"}
    </Button>
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form.moedas?.length === 0) return toast("Escolha ao menos uma moeda", "error")
    const config = form
    simulation.mutate(config, {
      onSuccess: (result) =>
        setRuns((current) => {
          const kept = current.slice(-(MAX_RUNS - 1))
          const used = new Set(kept.map((r) => r.slot))
          const slot = [0, 1, 2, 3, 4, 5].find((s) => !used.has(s)) ?? 0
          return [...kept, { id: Date.now(), slot, config, result }]
        }),
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
      <div ref={formRef} className="scroll-mt-24">
        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nova simulação</h3>
            <p className="mt-1 text-xs text-slate-400">Só os scripts sem IA: não custam nada além da taxa da corretora.</p>
          </div>
          <div role="radiogroup" aria-label="O que simular" className="grid grid-cols-2 gap-1.5">
            {[
              { carteira: false, nome: "Uma moeda", Icon: Bot },
              { carteira: true, nome: "Carteira", Icon: Coins },
            ].map(({ carteira, nome, Icon }) => (
              <button
                key={nome}
                type="button"
                role="radio"
                aria-checked={portfolio === carteira}
                onClick={() =>
                  setForm((f) => {
                    if (carteira) return portfolioConfig(f, catalog)
                    const { moedas: _, ...rest } = f
                    return { ...rest, ...DEFAULT_CONFIG }
                  })
                }
                className={clsx(chipClasses(portfolio === carteira), "flex items-center justify-center gap-1.5 py-2 text-sm")}
              >
                <Icon size={15} /> {nome}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {form.moedas ? (
              <PortfolioFields value={form} onChange={setForm} catalog={catalog} />
            ) : (
              <ConfigFields
                value={form}
                onChange={(config) => setForm((f) => ({ ...f, ...config, dias: clampDays(f.dias, config.tempo_grafico) }))}
                catalog={catalog}
              />
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <Label htmlFor="sim-periodo">Período</Label>
                  <Select
                    id="sim-periodo"
                    value={byDates ? "datas" : form.dias}
                    onChange={(e) =>
                      setForm(
                        e.target.value === "datas"
                          ? { ...form, de: isoDate(new Date(Date.now() - form.dias * 86_400_000)), ate: todayISO() }
                          : { ...form, dias: Number(e.target.value), de: null, ate: null }
                      )
                    }
                  >
                    {periods.map((p) => (
                      <option key={p.dias} value={p.dias}>
                        {p.nome}
                      </option>
                    ))}
                    <option value="datas">Escolher datas…</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sim-capital">Capital inicial (USDT)</Label>
                  <Input
                    id="sim-capital"
                    type="number"
                    inputMode="decimal"
                    required
                    min={1}
                    step="any"
                    value={Number.isNaN(form.capital) ? "" : form.capital}
                    onChange={(e) => setForm({ ...form, capital: e.target.valueAsNumber })}
                  />
                </div>
                {rates?.USD?.rate && form.capital > 0 && (
                  <p className="col-span-2 -mt-1 text-right text-[11px] text-slate-400">
                    ≈ {formatMoney(form.capital * Number(rates.USD.rate), "BRL")} (USDT ≈ dólar)
                  </p>
                )}
              </div>
              {byDates && (
                <div className="grid grid-cols-2 items-end gap-3">
                  <div>
                    <Label htmlFor="sim-de">De</Label>
                    <Input
                      id="sim-de"
                      type="date"
                      required
                      max={form.ate ?? todayISO()}
                      value={form.de ?? ""}
                      onChange={(e) => setForm({ ...form, de: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sim-ate">Até</Label>
                    <Input
                      id="sim-ate"
                      type="date"
                      required
                      min={form.de ?? undefined}
                      max={todayISO()}
                      value={form.ate ?? ""}
                      onChange={(e) => setForm({ ...form, ate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            {simulation.error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                {simulation.error.message}
              </p>
            )}
            <Button type="submit" disabled={simulation.isPending} className="w-full">
              <Play size={16} /> {simulation.isPending ? "Simulando..." : "Simular"}
            </Button>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Velas reais da Bybit. Entrada a mercado (se a vela abrir além do rompimento, entra na abertura), taxa de{" "}
              {plain(catalog.taxa * 100)}% em cada ponta e {plain(catalog.deslizamento * 100)}% de deslizamento; se stop e alvo
              cabem na mesma vela, conta o stop. A primeira simulação de um par baixa anos de velas e pode levar um minuto.
            </p>
          </form>
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        {runs.length === 0 ? (
          <Card className="text-sm text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">Nenhuma simulação ainda</p>
            <p className="mt-1">
              Escolha o script e os parâmetros e clique em Simular. Cada resultado fica aqui, um ao lado do outro (até {MAX_RUNS}), com o
              gráfico de todos juntos e a tabela para comparar. O que der certo vira robô em “Usar num robô”.
            </p>
            <p className="mt-3">
              Para a carteira (a mesma regra em várias moedas ao mesmo tempo, o que mais rendeu na pesquisa de out/2026), escolha
              “Carteira” no topo do formulário.
            </p>
            <p className="mt-3">
              Ou veja uma demonstração: seis configurações comparadas nos últimos 3 anos (a recomendada, BTC 1h 10/12/13/2.9 com risco de
              1%, contra as outras e contra o bot antigo, SOL 15m com saldo inteiro). A primeira vez baixa as velas e pode levar um minuto.
            </p>
            <div className="mt-3">{demoButton}</div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Evolução do capital</h3>
                <span className="ml-auto">{demoButton}</span>
                <button
                  onClick={() =>
                    ask({
                      title: "Limpar simulações",
                      message: `Apagar as ${runs.length} simulações da comparação?`,
                      tone: "danger",
                      confirmLabel: "Limpar",
                      action: async () => setRuns([]),
                    })
                  }
                  className="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  Limpar tudo
                </button>
              </div>
              <ComparisonChart runs={shown} catalog={catalog} />
            </Card>
            <Card className="overflow-x-auto p-0">
              <MetricsTable runs={shown} catalog={catalog} />
            </Card>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  catalog={catalog}
                  onEdit={() => {
                    setForm(run.config)
                    formRef.current?.scrollIntoView({ behavior: "smooth" })
                  }}
                  onUse={() => onUseInRobot(run.config)}
                  onRemove={() => setRuns((current) => current.filter((r) => r.id !== run.id))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
