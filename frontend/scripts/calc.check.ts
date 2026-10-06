import assert from "node:assert"
import { evaluateSheet } from "../src/lib/calc.ts"

const values = (text: string, refs: Record<string, number> = {}) =>
  evaluateSheet(text, refs).map((r) => (r.kind === "value" ? r.value : r.kind))

// pt-BR, variáveis, rótulo, %, soma por bloco
assert.deepEqual(
  values("capital = 10.000\njuros 10%: capital * 10%\n\nsoma\naluguel 1.200,50 + luz 4.99\nsoma"),
  [10000, 1000, "empty", 11000, 1205.49, 1205.49]
)
// referências do sistema, com acento e maiúscula
assert.deepEqual(values("@Emprestimo.Pedro.Lucas / 2", { "emprestimo.pedro.lucas": 5000 }), [2500])
assert.deepEqual(values("@nao.existe + 1"), ["error"])
// texto puro não vira conta; parênteses e divisão por zero
assert.deepEqual(values("lembrar de cobrar\n(10 + 5) * 2\n10 / 0"), ["empty", 30, "error"])
// palavra solta no meio é ignorada; dois números colados é erro
assert.deepEqual(values("2 cafés 3,50"), ["error"])
console.log("calc ok")
