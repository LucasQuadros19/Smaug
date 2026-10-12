import { formatCurrency, formatDate } from "./format"
import type { Loan, LoanEvent } from "../types"

const KIND: Record<string, string> = { principal: "Principal", interest: "Juros", fee: "Multa / atraso" }

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/**
 * Recibo de um recebimento do empréstimo, numa janela pronta para imprimir ou
 * "Salvar como PDF" (o navegador faz o PDF; sem biblioteca nova). Como no Fozesc,
 * o nome de quem assina fica em branco para preencher à mão.
 */
export function printLoanReceipt(loan: Loan, event: LoanEvent) {
  const popup = window.open("", "_blank", "width=720,height=900")
  if (!popup) return alert("O navegador bloqueou a janela do recibo — libere pop-ups para este site.")

  const kinds = new Set(event.parts.map((p) => p.kind))
  // O que faltava logo depois DESTE recebimento (um recibo antigo não mostra o saldo de hoje).
  const principalBack = loan.repayments
    .filter((r) => r.kind === "principal" && (r.event_id != null ? r.event_id <= event.id : r.date <= event.date))
    .reduce((sum, r) => sum + r.amount, 0)
  const left = Math.max(Math.round((loan.total_contributed - principalBack) * 100) / 100, 0)
  const what = kinds.has("principal")
    ? left <= 0
      ? "quitação"
      : "pagamento parcial"
    : "juros"
  const rows = event.parts
    .map((p) => `<tr><td>${KIND[p.kind] ?? p.kind}</td><td class="num">${formatCurrency(p.amount)}</td></tr>`)
    .join("")
  const after = [
    ["Principal que ainda faltava", formatCurrency(left)],
    ...(event.due_after ? [["Próximo vencimento", formatDate(event.due_after)]] : []),
  ]
    .map(([label, value]) => `<tr><td>${label}</td><td class="num">${value}</td></tr>`)
    .join("")
  const line = "_______________________________________"

  popup.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo - ${escape(loan.borrower)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", sans-serif; color: #111; max-width: 640px; margin: 40px auto; padding: 0 24px; }
  h1 { text-align: center; font-size: 20px; letter-spacing: .05em; margin-bottom: 4px; }
  .total { text-align: center; font-size: 30px; font-weight: 700; margin: 4px 0 24px; }
  p { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { border: 1px solid #ccc; padding: 8px 10px; }
  td.num { text-align: right; white-space: nowrap; }
  tr.sum td { font-weight: 700; }
  .sign { margin-top: 72px; display: flex; gap: 32px; }
  .sign div { flex: 1; text-align: center; border-top: 1px solid #111; padding-top: 6px; font-size: 13px; }
  .muted { color: #666; font-size: 12px; }
  @media print { button { display: none; } }
</style></head><body>
  <h1>RECIBO</h1>
  <p class="total">${formatCurrency(event.total)}</p>
  <p>Recebi de <strong>${escape(loan.borrower)}</strong> a quantia de <strong>${formatCurrency(event.total)}</strong>,
  referente a ${what} do empréstimo de ${formatCurrency(loan.amount)} feito em ${formatDate(loan.start_date)}.</p>
  <table>${rows}<tr class="sum"><td>Total recebido em ${formatDate(event.date)}</td><td class="num">${formatCurrency(event.total)}</td></tr></table>
  <table>${after}</table>
  ${event.notes ? `<p class="muted">Obs.: ${escape(event.notes)}</p>` : ""}
  <p style="text-align:right;margin-top:40px">${line}, ${new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.</p>
  <div class="sign"><div>Quem recebeu</div><div>${escape(loan.borrower)}</div></div>
  <p style="text-align:center;margin-top:32px"><button onclick="window.print()">Imprimir / Salvar PDF</button></p>
</body></html>`)
  popup.document.close()
}
