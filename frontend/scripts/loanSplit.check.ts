import { splitLoan } from "../src/lib/loanSplit.ts"
import assert from "node:assert"

// João 10k, eu nada; volta 11k; comissão 30% → João 10.700, eu 300
let r = splitLoan([{ name: "João", contributed: 10000, to_receive: 0, is_me: false }], 11000, 30)
assert.deepEqual(r.map((p) => [p.name, p.to_receive]), [["João", 10700], ["Eu", 300]])

// Meio a meio 25k/25k, volta 55k, comissão 20%: lucro 5k, comissão 1k, resto 4k → 2k cada
r = splitLoan(
  [
    { name: "Eu", contributed: 25000, to_receive: 0, is_me: true },
    { name: "Sócio", contributed: 25000, to_receive: 0, is_me: false },
  ],
  55000,
  20
)
assert.deepEqual(r.map((p) => p.to_receive), [28000, 27000])

// Sem comissão e sem "eu": não inventa linha
r = splitLoan([{ name: "A", contributed: 100, to_receive: 0, is_me: false }], 110, 0)
assert.equal(r.length, 1)
assert.equal(r[0].to_receive, 110)
console.log("splitLoan ok")
