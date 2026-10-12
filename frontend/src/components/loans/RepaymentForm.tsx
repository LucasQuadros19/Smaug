import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { Toggle } from "../ui/Toggle"
import { BusinessDayHint } from "../ui/BusinessDayHint"
import { useAccounts } from "../../hooks/useAccounts"
import { useSettings } from "../../hooks/useMe"
import { addMonths, formatCurrency, formatDate, todayISO } from "../../lib/format"
import { cents } from "../../lib/loanSplit"
import type { Loan } from "../../types"
import type { RepaymentInput, RepaymentPart } from "../../api/loans"

export type RepaymentMode = "interest" | "full"

/** Um valor recebido e quanto dele é meu; o resto é dos sócios. */
function Part({
  title,
  amount,
  mine,
  onAmount,
  onMine,
  hasPartners,
}: {
  title: string
  amount: string
  mine: string
  onAmount: (value: string) => void
  onMine: (value: string) => void
  hasPartners: boolean
}) {
  const partners = cents((Number(amount) || 0) - (Number(mine) || 0))
  return (
    <div className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-white/5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => onAmount(e.target.value)} />
        </div>
        {hasPartners && (
          <div>
            <Label>Minha parte</Label>
            <Input type="number" step="0.01" min="0" value={mine} onChange={(e) => onMine(e.target.value)} />
          </div>
        )}
      </div>
      {hasPartners && (
        <p className={partners < 0 ? "text-xs text-rose-600 dark:text-rose-400" : "text-xs text-slate-400"}>
          {partners < 0 ? `Minha parte passa ${formatCurrency(-partners)} do valor.` : `Dos sócios: ${formatCurrency(partners)}`}
        </p>
      )}
    </div>
  )
}

/**
 * Recebimento de um mês. "Só os juros" mantém o principal na rua e empurra o
 * vencimento; "Recebi" traz o principal (a parcela, ou tudo para quitar) e os juros.
 * Tudo vem sugerido e pode ser mudado.
 */
export function RepaymentForm({
  loan,
  mode,
  onSubmit,
  onCancel,
  submitting,
}: {
  loan: Loan
  mode: RepaymentMode
  onSubmit: (data: RepaymentInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: accounts } = useAccounts()
  const next = loan.next_payment
  const hasPartners = loan.participants.some((p) => !p.is_me)
  const noMe = !loan.participants.some((p) => p.is_me) && loan.participants.length > 0

  // "Recebi" num empréstimo só de juros, antes do último mês, é quitar: o principal todo.
  const principalDefault = mode === "interest" ? 0 : next.principal > 0 ? next.principal : loan.principal_outstanding
  const myPrincipalDefault =
    next.principal > 0 ? next.my_principal : loan.principal_outstanding > 0 ? loan.my_outstanding : 0
  // Para repartir o que for digitado: a proporção da sugestão, ou a do empréstimo.
  const ratio = (mineValue: number, total: number, fallback: number) =>
    noMe ? 0 : total > 0 ? mineValue / total : fallback
  const principalRatio = ratio(
    myPrincipalDefault,
    principalDefault,
    loan.total_contributed > 0 ? loan.my_principal / loan.total_contributed : 1
  )
  const interestRatio = ratio(next.my_interest, next.interest, 1)

  const [interest, setInterest] = useState(String(next.interest || ""))
  const [myInterest, setMyInterest] = useState(String(noMe ? 0 : next.my_interest || ""))
  const [principal, setPrincipal] = useState(String(principalDefault || ""))
  const [myPrincipal, setMyPrincipal] = useState(String(noMe ? 0 : myPrincipalDefault || ""))
  // Atrasado além da tolerância: multa + mora (por dia) pelos padrões de mercado, sobre o que vencia.
  const { settings } = useSettings()
  const today = todayISO()
  const daysLate =
    loan.due_date && loan.due_date < today
      ? Math.round((Date.parse(today) - Date.parse(loan.due_date)) / 86_400_000)
      : 0
  const lateBase = cents(next.interest + next.principal)
  const charged = daysLate > settings.grace_days
  const fine = charged ? cents((lateBase * settings.late_fine) / 100) : 0
  const mora = charged ? cents((lateBase * settings.late_interest * daysLate) / 100 / 30) : 0
  const [hasFee, setHasFee] = useState(fine + mora > 0)
  const [fee, setFee] = useState(fine + mora > 0 ? String(cents(fine + mora)) : "")
  const [myFee, setMyFee] = useState(fine + mora > 0 ? String(cents((fine + mora) * (noMe ? 0 : next.interest > 0 ? next.my_interest / next.interest : 1))) : "")
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState(0)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [notes, setNotes] = useState("")

  const principalValue = Number(principal) || 0
  const principalLeft = cents(loan.principal_outstanding - principalValue)
  const continues = mode === "interest" || principalLeft > 0
  const [goOn, setGoOn] = useState(true)
  const [nextDue, setNextDue] = useState(addMonths(loan.due_date ?? todayISO(), 1))

  // Mudar o valor reparte de novo na mesma proporção; a minha parte digitada vale até lá.
  const changeAmount = (set: (v: string) => void, setMine: (v: string) => void, share: number) => (value: string) => {
    set(value)
    setMine(String(cents((Number(value) || 0) * share)))
  }

  const toPart = (kind: RepaymentPart["kind"], amount: string, mine: string): RepaymentPart | null => {
    const value = Number(amount) || 0
    if (value <= 0) return null
    const my = hasPartners || noMe ? Number(mine) || 0 : value
    return { kind, amount: value, my_share: my, partners_share: cents(value - my) }
  }
  const parts = [
    mode === "full" ? toPart("principal", principal, myPrincipal) : null,
    toPart("interest", interest, myInterest),
    hasFee ? toPart("fee", fee, myFee) : null,
  ].filter((p): p is RepaymentPart => p !== null)
  const total = parts.reduce((s, p) => s + p.amount, 0)
  const partnersTotal = parts.reduce((s, p) => s + p.partners_share, 0)
  const invalid = parts.some((p) => p.partners_share < 0)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          date,
          account_id: accountId,
          parts,
          partners_settled: alreadyPaid,
          next_due_date: continues && goOn ? nextDue : null,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[0.03]">
        <div>
          <p className="text-xs text-slate-400">Mês</p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {next.month} de {loan.months}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Principal na rua</p>
          <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(loan.principal_outstanding)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Juros do mês</p>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(loan.monthly_interest)}</p>
        </div>
        {loan.interest_pending > 0 && (
          <div>
            <p className="text-xs text-slate-400">Juros em atraso</p>
            <p className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(loan.interest_pending)}</p>
          </div>
        )}
        {loan.due_date && (
          <div>
            <p className="text-xs text-slate-400">Vencimento</p>
            <p className="font-semibold text-slate-900 dark:text-white">{formatDate(loan.due_date)}</p>
          </div>
        )}
      </div>

      {mode === "full" && (
        <Part
          title={loan.schedule === "installments" && principalLeft > 0 ? "Parcela do principal" : "Principal"}
          amount={principal}
          mine={myPrincipal}
          onAmount={changeAmount(setPrincipal, setMyPrincipal, principalRatio)}
          onMine={setMyPrincipal}
          hasPartners={hasPartners}
        />
      )}
      <Part
        title={loan.interest_pending > 0 ? `Juros (o do mês + ${formatCurrency(loan.interest_pending)} em atraso)` : "Juros"}
        amount={interest}
        mine={myInterest}
        onAmount={changeAmount(setInterest, setMyInterest, interestRatio)}
        onMine={setMyInterest}
        hasPartners={hasPartners}
      />

      <Toggle
        checked={hasFee}
        onChange={setHasFee}
        label="Teve multa ou juros de atraso"
        hint={
          charged
            ? `${daysLate} dias de atraso sobre ${formatCurrency(lateBase)}: multa ${settings.late_fine}% (${formatCurrency(fine)}) + mora ${settings.late_interest}% ao mês por dia (${formatCurrency(mora)}). Dá para mudar ou tirar.`
            : "Um valor a mais por atrasar. Entra como receita e não conta como juros do mês."
        }
      />
      {hasFee && (
        <Part
          title="Multa / atraso"
          amount={fee}
          mine={myFee}
          onAmount={changeAmount(setFee, setMyFee, interestRatio)}
          onMine={setMyFee}
          hasPartners={hasPartners}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Entrou em qual conta</Label>
          <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} required>
            <option value={0} disabled>
              Selecione
            </option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {continues ? (
        <div className="space-y-2">
          <Toggle
            checked={goOn}
            onChange={setGoOn}
            label="Continua para o próximo mês"
            hint={
              mode === "interest"
                ? "O principal fica na rua e o vencimento passa para a data abaixo."
                : `Ainda ficam ${formatCurrency(principalLeft)} do principal na rua.`
            }
          />
          {goOn ? (
            <div>
              <Label>Próximo vencimento</Label>
              <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} required />
              <BusinessDayHint date={nextDue} onPick={setNextDue} />
            </div>
          ) : (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Pagamento parcial: o vencimento continua{loan.due_date ? ` em ${formatDate(loan.due_date)}` : ""} e o que
              faltar fica pendente para o próximo recebimento.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          Volta todo o principal: o empréstimo fica quitado quando a sua parte inteira tiver voltado.
        </p>
      )}

      {partnersTotal > 0 && (
        <Toggle
          checked={alreadyPaid}
          onChange={setAlreadyPaid}
          label="Já repassei aos sócios"
          hint="Se ainda não repassou, o dinheiro deles fica no seu caixa mas sai do seu patrimônio — e você marca o repasse depois."
        />
      )}

      <div>
        <Label>Observação (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: pagou no Pix" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Entra na conta <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(total)}</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !accountId || parts.length === 0 || invalid}>
            Registrar
          </Button>
        </div>
      </div>
    </form>
  )
}
