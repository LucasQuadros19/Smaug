import clsx from "clsx"
import type { BotCatalog, BotConfig, BotParams, BotSimulationInput, BotStrategyId, BotTimeframe } from "../types"

/** O mesmo limite da API do bot: no gráfico de 5 min dá pouco mais de 1 ano. */
const MAX_CANDLES = 110_000

/** O que deu mais estável no gráfico de 1h na avaliação de out/2026. */
export const DEFAULT_CONFIG: BotConfig = {
  estrategia: "long_short",
  cripto: "BTCUSDT",
  tempo_grafico: "60",
  compra: { ema_rapida: 10, ema_lenta: 12, qtd_velas_stop: 13, risco_retorno: 2.9 },
  venda: null,
  alavancagem: 1,
  risco_pct: 1,
}

export const COINS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "LINK", "AVAX", "SUI"]

export const TIMEFRAME_SHORT: Record<BotTimeframe, string> = {
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
}

export const PERIODS = [
  { dias: 90, nome: "Últimos 3 meses" },
  { dias: 180, nome: "Últimos 6 meses" },
  { dias: 365, nome: "Último ano" },
  { dias: 730, nome: "Últimos 2 anos" },
  { dias: 1095, nome: "Últimos 3 anos" },
]

export function maxDays(tempo: BotTimeframe) {
  return Math.floor((MAX_CANDLES * Number(tempo)) / 1440)
}

export function periodName(config: Pick<BotSimulationInput, "dias" | "de" | "ate">) {
  if (config.de && config.ate) {
    const br = (iso: string) => iso.split("-").reverse().join("/")
    return `${br(config.de)} a ${br(config.ate)}`
  }
  return PERIODS.find((p) => p.dias === config.dias)?.nome ?? `${config.dias} dias`
}

export function clampDays(dias: number, tempo: BotTimeframe) {
  const fits = PERIODS.filter((p) => p.dias <= maxDays(tempo))
  return Math.min(dias, fits[fits.length - 1].dias)
}

/** Troca o script mantendo os parâmetros que já estavam preenchidos; o lado novo vem do padrão do script. */
export function withStrategy(config: BotConfig, id: BotStrategyId, catalog: BotCatalog): BotConfig {
  const padrao = catalog.estrategias.find((e) => e.id === id)!.padrao
  const current = config.compra ?? config.venda
  return {
    ...config,
    estrategia: id,
    compra: id === "venda" ? null : (config.compra ?? current ?? padrao.compra),
    venda:
      id === "dual_params"
        ? (config.venda ?? padrao.venda)
        : id === "venda"
          ? (config.venda ?? current ?? padrao.venda)
          : null,
  }
}

export function paramsText(p: BotParams) {
  return `${p.ema_rapida}/${p.ema_lenta}/${p.qtd_velas_stop}/${p.risco_retorno}`
}

export function coin(cripto: string) {
  return cripto.replace(/USDT$/, "")
}

export function runName(config: Pick<BotSimulationInput, "cripto" | "moedas">) {
  return config.moedas ? `Carteira de ${config.moedas.length}` : coin(config.cripto)
}

/** A regra da carteira (só 1h e long_short) com o período e o capital que já estavam no formulário. */
export function portfolioConfig(form: BotSimulationInput, catalog: BotCatalog): BotSimulationInput {
  const { moedas, parametros, risco_pct, alavancagem } = catalog.carteira
  return {
    ...form,
    estrategia: "long_short",
    cripto: moedas[0],
    tempo_grafico: "60",
    compra: parametros,
    venda: parametros,
    alavancagem,
    risco_pct,
    moedas,
  }
}

export function timeframeName(tempo: BotTimeframe, catalog: BotCatalog) {
  return catalog.tempos.find((t) => t.valor === tempo)?.nome ?? `${tempo} min`
}

export function strategyText(config: BotConfig, catalog: BotCatalog) {
  const nome = catalog.estrategias.find((e) => e.id === config.estrategia)?.nome ?? config.estrategia
  const params =
    config.estrategia === "dual_params" && config.compra && config.venda
      ? `C ${paramsText(config.compra)} · V ${paramsText(config.venda)}`
      : paramsText((config.compra ?? config.venda)!)
  return `${nome} · ${params}`
}

export function sizingText(config: BotConfig) {
  const base =
    config.risco_pct == null ? "saldo inteiro" : `risco de ${config.risco_pct.toLocaleString("pt-BR")}% por operação`
  return config.alavancagem > 1 ? `${base} · até ${config.alavancagem.toLocaleString("pt-BR")}× o saldo` : base
}

/** Junta as curvas pela data, em % de retorno (capitais diferentes ficam comparáveis): { t, s0, s1, ... }. */
export function mergeCurves(curves: { capital: number; points: { t: number; v: number }[] }[]) {
  const rows = new Map<number, Record<string, number>>()
  curves.forEach(({ capital, points }, i) => {
    for (const { t, v } of points) {
      const row = rows.get(t) ?? { t }
      row[`s${i}`] = Math.round((v / capital - 1) * 10_000) / 100
      rows.set(t, row)
    }
  })
  return [...rows.values()].sort((a, b) => a.t - b.t)
}

export function bestIndex(values: (number | null)[], better: "higher" | "lower") {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length < 2 || valid.every((v) => v === valid[0])) return -1
  const best = better === "higher" ? Math.max(...valid) : Math.min(...valid)
  return values.indexOf(best)
}

export const chipClasses = (selected: boolean) =>
  clsx(
    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300"
      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20"
  )
