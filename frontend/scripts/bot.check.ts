import assert from "node:assert"
import { bestIndex, clampDays, mergeCurves, portfolioConfig, runName, withStrategy } from "../src/lib/bot.ts"
import type { BotCatalog, BotConfig } from "../src/types/index.ts"

const p = (ema_rapida: number, ema_lenta: number, qtd_velas_stop: number, risco_retorno: number) => ({
  ema_rapida,
  ema_lenta,
  qtd_velas_stop,
  risco_retorno,
})
const catalog = {
  estrategias: [
    { id: "long_short", padrao: { compra: p(5, 45, 13, 1.7), venda: p(5, 45, 13, 1.7) } },
    { id: "dual_params", padrao: { compra: p(5, 45, 13, 1.7), venda: p(8, 50, 10, 2) } },
    { id: "compra", padrao: { compra: p(5, 15, 17, 4.1), venda: null } },
    { id: "venda", padrao: { compra: null, venda: p(9, 21, 17, 3.5) } },
  ],
  carteira: { moedas: ["BTCUSDT", "XRPUSDT"], parametros: p(5, 45, 13, 1.7), risco_pct: 0.5, alavancagem: 10 },
} as unknown as BotCatalog
const base: BotConfig = {
  estrategia: "long_short",
  cripto: "BTCUSDT",
  tempo_grafico: "60",
  compra: p(10, 12, 13, 2.9),
  venda: null,
  alavancagem: 1,
  risco_pct: 1,
}

// trocar de script mantém o que estava preenchido; o lado novo vem do padrão do script
let config = withStrategy(base, "dual_params", catalog)
assert.deepEqual([config.compra, config.venda], [p(10, 12, 13, 2.9), p(8, 50, 10, 2)])
config = withStrategy(base, "venda", catalog)
assert.deepEqual([config.compra, config.venda], [null, p(10, 12, 13, 2.9)])
config = withStrategy(config, "long_short", catalog)
assert.deepEqual([config.compra, config.venda], [p(10, 12, 13, 2.9), null])
config = withStrategy({ ...base, estrategia: "venda", compra: null, venda: p(9, 21, 17, 3.5) }, "compra", catalog)
assert.deepEqual([config.compra, config.venda], [p(9, 21, 17, 3.5), null])

// período: no gráfico de 5 min só cabe 1 ano
assert.equal(clampDays(1095, "5"), 365)
assert.equal(clampDays(1095, "60"), 1095)

// curvas juntas pela data, em % do capital de cada uma
assert.deepEqual(
  mergeCurves([
    { capital: 100, points: [{ t: 1, v: 100 }, { t: 2, v: 110 }] },
    { capital: 50, points: [{ t: 2, v: 40 }] },
  ]),
  [{ t: 1, s0: 0 }, { t: 2, s0: 10, s1: -20 }]
)

// destaque só quando há o que comparar
assert.equal(bestIndex([5, null, 9], "higher"), 2)
assert.equal(bestIndex([-30, -10], "higher"), 1)
assert.equal(bestIndex([3, 3], "lower"), -1)
assert.equal(bestIndex([4], "higher"), -1)
// a carteira troca a regra pela dela, mas guarda período e capital do formulário
const carteira = portfolioConfig({ ...base, estrategia: "compra", tempo_grafico: "15", dias: 730, capital: 110 }, catalog)
assert.deepStrictEqual(
  [carteira.estrategia, carteira.tempo_grafico, carteira.risco_pct, carteira.dias, carteira.capital, carteira.venda],
  ["long_short", "60", 0.5, 730, 110, p(5, 45, 13, 1.7)]
)
assert.equal(runName(carteira), "Carteira de 2")
assert.equal(runName(base), "BTC")

console.log("bot ok")
