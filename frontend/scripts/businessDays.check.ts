import assert from "node:assert/strict"
import { holidayName, nextBusinessDay, notBusinessReason } from "../src/lib/businessDays.ts"

// Páscoa de 2026 é 5/4: Carnaval 16 e 17/2, Sexta-feira Santa 3/4, Corpus Christi 4/6.
assert.equal(holidayName("2026-02-16"), "Carnaval")
assert.equal(holidayName("2026-04-03"), "Sexta-feira Santa")
assert.equal(holidayName("2026-06-04"), "Corpus Christi")
assert.equal(holidayName("2026-11-20"), "Consciência Negra")
assert.equal(holidayName("2026-11-21"), null)

assert.equal(notBusinessReason("2026-10-10"), "Sábado")
assert.equal(notBusinessReason("2026-10-13"), null)

// Sábado 10/10 → domingo → segunda 12/10 é feriado → terça 13/10.
assert.equal(nextBusinessDay("2026-10-10"), "2026-10-13")
assert.equal(nextBusinessDay("2026-10-13"), "2026-10-13")
// Sexta-feira Santa 3/4 → sábado, domingo → segunda 6/4.
assert.equal(nextBusinessDay("2026-04-03"), "2026-04-06")

console.log("businessDays ok")
