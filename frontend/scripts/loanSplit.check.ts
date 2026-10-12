import assert from "node:assert/strict"
import { fillRemainder } from "../src/lib/loanSplit.ts"

// Lucro de 1000: um ganha 700, o outro completa com 300.
assert.deepEqual(fillRemainder([700, null], 1000), [700, 300])

// Comissão de 200 sai do lucro: sobram 800 para dividir.
assert.deepEqual(fillRemainder([700, null], 1000 - 200), [700, 100])

// Em branco dividem pelo peso (quanto cada um emprestou).
assert.deepEqual(fillRemainder([null, null], 1000, [6000, 4000]), [600, 400])

// Sem peso, partes iguais; o arredondamento fecha no último.
assert.deepEqual(fillRemainder([null, null, null], 100), [33.33, 33.33, 33.34])

// Digitado passa do total: o em branco fica com zero (a tela avisa).
assert.deepEqual(fillRemainder([1200, null], 1000), [1200, 0])

// Todos digitados: nada muda.
assert.deepEqual(fillRemainder([300, 200], 1000), [300, 200])

console.log("loanSplit ok")
