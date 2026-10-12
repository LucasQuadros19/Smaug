import { useState } from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { SegmentedControl } from "../ui/SegmentedControl"
import { Toggle } from "../ui/Toggle"
import { LoanBars } from "./LoanBars"
import { BusinessDayHint } from "../ui/BusinessDayHint"
import { useAccounts } from "../../hooks/useAccounts"
import { useSettings } from "../../hooks/useMe"
import { usePlaylists } from "../../hooks/usePlaylists"
import { addMonths, formatCurrency, todayISO } from "../../lib/format"
import { cents, fillRemainder } from "../../lib/loanSplit"
import type { Loan, LoanSchedule, LoanStatus } from "../../types"
import type { LoanInput } from "../../api/loans"

const STATUS_LABELS: Record<LoanStatus, string> = {
  active: "Em aberto",
  paid: "Quitado",
  late: "Atrasado",
}

/** `null` em emprestou/ganha = em branco: completa sozinho com o que falta. */
type Row = { name: string; is_me: boolean; commissionOnly: boolean; contributed: number | null; gain: number | null }

const newRow = (isMe = false): Row => ({ name: isMe ? "Eu" : "", is_me: isMe, commissionOnly: false, contributed: null, gain: null })

const parse = (value: string) => (value === "" ? null : Number(value))
const sum = (values: number[]) => cents(values.reduce((a, b) => a + b, 0))

function rowsFrom(loan: Loan, commissionTo: number): Row[] {
  const rows = loan.participants.map(
    (p): Row => ({
      name: p.name,
      is_me: p.is_me,
      commissionOnly: p.contributed === 0 && p.gain === 0 && p.commission > 0,
      contributed: p.contributed,
      gain: p.gain,
    })
  )
  // Uma pessoa volta a completar sozinha, se o que está salvo já fecha a conta.
  const lenders = rows.flatMap((r, i) => (r.commissionOnly ? [] : [i]))
  const last = lenders[lenders.length - 1]
  if (last !== undefined) {
    if (sum(lenders.map((i) => rows[i].contributed ?? 0)) === cents(loan.amount)) rows[last] = { ...rows[last], contributed: null }
  }
  const lastGain = lenders.filter((i) => i !== commissionTo).pop()
  if (lastGain !== undefined) rows[lastGain] = { ...rows[lastGain], gain: null }
  return rows
}

export function LoanForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Loan
  onSubmit: (data: LoanInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const savedCommission = initial?.participants.findIndex((p) => p.commission > 0) ?? -1
  const [hasCommission, setHasCommission] = useState(savedCommission >= 0)
  const [commission, setCommission] = useState(savedCommission >= 0 ? String(initial!.participants[savedCommission].commission) : "")
  const [commissionTo, setCommissionTo] = useState(Math.max(savedCommission, 0))

  const { settings } = useSettings()
  const { data: accounts } = useAccounts()
  const { data: playlists } = usePlaylists()
  const loansPosition = playlists?.find((p) => p.auto_source === "loans")
  const [borrower, setBorrower] = useState(initial?.borrower ?? "")
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
  // Cadastro novo já vem com os padrões de mercado das Configurações.
  const [rate, setRate] = useState(
    initial ? (initial.interest_rate != null ? String(initial.interest_rate) : "") : settings.loan_rate ? String(settings.loan_rate) : ""
  )
  const [profit, setProfit] = useState(initial && initial.monthly_interest > 0 ? String(initial.monthly_interest) : "")
  const [months, setMonths] = useState(String(initial?.months ?? settings.loan_months))
  const [schedule, setSchedule] = useState<LoanSchedule>(initial?.schedule ?? settings.loan_schedule)
  const [outflowAccount, setOutflowAccount] = useState(initial?.outflow?.account_id ?? 0)
  const [outflowAmount, setOutflowAmount] = useState<string | null>(initial?.outflow ? String(initial.outflow.amount) : null)
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO())
  const [dueDate, setDueDate] = useState(initial ? (initial.due_date ?? "") : addMonths(todayISO(), 1))
  const [status, setStatus] = useState<LoanStatus>(initial?.status ?? "active")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [rows, setRows] = useState<Row[]>(
    initial && initial.participants.length > 0 ? rowsFrom(initial, savedCommission) : [newRow(true)]
  )

  const loanAmount = Number(amount) || 0
  const monthlyProfit = Number(profit) || 0
  const monthCount = Math.max(Math.floor(Number(months) || 1), 1)
  const commissionValue = hasCommission ? Number(commission) || 0 : 0

  // Porcentagem e lucro andam juntos: mudar um recalcula o outro.
  const changeAmount = (value: string) => {
    setAmount(value)
    if (rate !== "" && value !== "") setProfit(String(cents((Number(value) * Number(rate)) / 100)))
  }
  const changeRate = (value: string) => {
    setRate(value)
    if (value !== "" && loanAmount > 0) setProfit(String(cents((loanAmount * Number(value)) / 100)))
  }
  const changeProfit = (value: string) => {
    setProfit(value)
    if (value !== "" && loanAmount > 0) setRate(String(cents((Number(value) / loanAmount) * 100)))
  }
  const changeStart = (value: string) => {
    setStartDate(value)
    if (!initial && value) setDueDate(addMonths(value, 1))
  }

  const patch = (index: number, changes: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...changes } : r)))

  const toggleCommissionOnly = (index: number) => {
    const turningOn = !rows[index].commissionOnly
    patch(index, { commissionOnly: turningOn, contributed: null, gain: null })
    if (turningOn) {
      setHasCommission(true)
      setCommissionTo(index)
    }
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
    if (index < commissionTo) setCommissionTo(commissionTo - 1)
    else if (index === commissionTo) setCommissionTo(0)
  }

  // Quem empresta divide o valor emprestado e o lucro do mês.
  const lenders = rows.flatMap((r, i) => (r.commissionOnly ? [] : [i]))
  const contributions = fillRemainder(lenders.map((i) => rows[i].contributed), loanAmount)
  const lentSum = sum(contributions)
  const gainByRow = new Map<number, number>()
  const recipientLends = hasCommission && lenders.includes(commissionTo)
  if (recipientLends) {
    // Quem empresta e fica com a comissão: o ganho dele não muda; a comissão sai dos outros.
    const k = lenders.indexOf(commissionTo)
    const own = rows[commissionTo].gain ?? (lentSum > 0 ? cents((monthlyProfit * contributions[k]) / lentSum) : 0)
    gainByRow.set(commissionTo, own)
    const others = lenders.filter((i) => i !== commissionTo)
    const pool = profit === "" ? 0 : monthlyProfit - commissionValue - own
    fillRemainder(others.map((i) => rows[i].gain), pool, others.map((i) => contributions[lenders.indexOf(i)])).forEach(
      (gain, j) => gainByRow.set(others[j], gain)
    )
  } else {
    const pool = profit === "" ? 0 : monthlyProfit - commissionValue
    fillRemainder(lenders.map((i) => rows[i].gain), pool, contributions).forEach((gain, k) => gainByRow.set(lenders[k], gain))
  }

  const people = rows.map((r, i) => {
    const k = lenders.indexOf(i)
    return {
      name: r.name,
      is_me: r.is_me,
      contributed: k >= 0 ? contributions[k] : 0,
      gain: gainByRow.get(i) ?? 0,
      commission: hasCommission && i === commissionTo ? commissionValue : 0,
    }
  })

  const gainSum = sum(people.map((p) => p.gain))
  // O que saiu da minha conta: a minha parte (ou o valor todo, sem divisão). Dá para mudar.
  const myContribution = sum(people.filter((p) => p.is_me).map((p) => p.contributed)) || (people.length <= 1 ? loanAmount : 0)
  const outflowValue = outflowAmount === null ? myContribution : Number(outflowAmount) || 0
  const percent = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "")
  const overLent = loanAmount > 0 && lentSum > loanAmount
  const overProfit = profit !== "" && cents(gainSum + commissionValue) > monthlyProfit
  const missingLent = loanAmount > 0 && lentSum < loanAmount ? cents(loanAmount - lentSum) : 0
  const missingProfit = profit !== "" && !overProfit ? cents(monthlyProfit - commissionValue - gainSum) : 0
  const blocked = overLent || overProfit

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (blocked) return
        onSubmit({
          borrower,
          amount: loanAmount,
          interest_rate: rate === "" ? null : Number(rate),
          months: monthCount,
          schedule,
          start_date: startDate,
          due_date: dueDate || null,
          status,
          notes: notes || null,
          participants: people
            .filter((p) => p.name.trim())
            .map((p) => ({ ...p, name: p.name.trim() })),
          outflow: outflowAccount
            ? { account_id: outflowAccount, amount: outflowValue }
            : initial?.outflow
              ? null
              : undefined,
        })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Para quem emprestou</Label>
          <Input value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="Nome da pessoa" required />
        </div>
        <div>
          <Label>Valor total emprestado</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => changeAmount(e.target.value)} required />
        </div>
        <div>
          <Label>Meses</Label>
          <Input type="number" step="1" min="1" max="600" value={months} onChange={(e) => setMonths(e.target.value)} required />
        </div>
        <div>
          <Label>Rende (% ao mês)</Label>
          <Input type="number" step="0.01" min="0" value={rate} onChange={(e) => changeRate(e.target.value)} placeholder="Ex: 10" />
        </div>
        <div>
          <Label>Lucro por mês (R$)</Label>
          <Input type="number" step="0.01" min="0" value={profit} onChange={(e) => changeProfit(e.target.value)} placeholder="Ex: 1000" />
        </div>
        <div className="col-span-2">
          <Label>Como o dinheiro volta</Label>
          <SegmentedControl<LoanSchedule>
            ariaLabel="Como o dinheiro volta"
            value={schedule}
            onChange={setSchedule}
            options={[
              { value: "interest_only", label: "Só juros por mês, principal no fim" },
              { value: "installments", label: "Parcelas (principal + juros)" },
            ]}
          />
        </div>
        {profit !== "" && loanAmount > 0 && (
          <p className="col-span-2 -mt-1 text-xs text-slate-400">
            {formatCurrency(monthlyProfit)} por mês
            {monthCount > 1 && ` · ${formatCurrency(monthlyProfit * monthCount)} em ${monthCount} meses`} · volta no total{" "}
            {formatCurrency(loanAmount + monthlyProfit * monthCount)}
            {schedule === "installments" &&
              monthCount > 1 &&
              ` · parcela de ${formatCurrency(cents(loanAmount / monthCount) + monthlyProfit)}`}
          </p>
        )}
        <div>
          <Label>Quando emprestou</Label>
          <Input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} required />
        </div>
        <div>
          <Label>{initial ? "Próximo vencimento" : "Primeiro vencimento"}</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <BusinessDayHint date={dueDate} onPick={setDueDate} />
        </div>
        <div className="col-span-2">
          <Label>Situação</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as LoanStatus)}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-100 p-3 dark:border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Divisão</p>
            <p className="text-xs text-slate-400">O ganho é por mês. Deixe um campo em branco e ele completa sozinho.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setRows((prev) => [...prev, newRow()])}>
            <Plus size={15} /> Pessoa
          </Button>
        </div>

        <div className="space-y-2">
          {rows.map((row, index) => {
            const person = people[index]
            return (
              <div
                key={index}
                className={clsx(
                  "space-y-2 rounded-lg border p-2",
                  row.is_me
                    ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/20 dark:bg-indigo-500/5"
                    : "border-slate-100 dark:border-white/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    onChange={(e) => patch(index, { name: e.target.value })}
                    placeholder="Nome"
                    aria-label="Nome"
                    className="min-w-0 flex-1"
                  />
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.is_me}
                      onChange={(e) => patch(index, { is_me: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 dark:border-white/20 dark:bg-white/5"
                    />
                    eu
                  </label>
                  <button
                    type="button"
                    aria-pressed={row.commissionOnly}
                    onClick={() => toggleCommissionOnly(index)}
                    className={clsx(
                      "shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                      row.commissionOnly
                        ? "bg-[#8b80a6] text-white dark:bg-[#a197bd] dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                    )}
                  >
                    Só comissão
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                    aria-label="Remover pessoa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {row.commissionOnly ? (
                  <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                    Não empresta nem ganha do lucro —{" "}
                    {person.commission > 0 ? (
                      <span className="font-medium text-[#7a6f96] dark:text-[#b3a9cf]">
                        fica com a comissão de {formatCurrency(person.commission)} por mês
                      </span>
                    ) : (
                      "escolha essa pessoa em “Fica com” na comissão."
                    )}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="mb-1 flex justify-between">
                        Emprestou <span className="text-slate-400">{percent(person.contributed, loanAmount)}</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.contributed ?? ""}
                        onChange={(e) => patch(index, { contributed: parse(e.target.value) })}
                        placeholder={person.contributed ? person.contributed.toFixed(2) : "0,00"}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 flex justify-between">
                        Ganha/mês <span className="text-slate-400">{percent(person.gain, monthlyProfit)}</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.gain ?? ""}
                        onChange={(e) => patch(index, { gain: parse(e.target.value) })}
                        placeholder={person.gain ? person.gain.toFixed(2) : "0,00"}
                      />
                    </div>
                    <div>
                      <Label className="mb-1">Recebe/mês</Label>
                      <p className="flex h-[38px] items-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(person.gain + person.commission)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Toggle
          checked={hasCommission}
          onChange={setHasCommission}
          label="Tem comissão"
          hint={
            recipientLends
              ? "Quem fica com ela também emprestou: o ganho dessa pessoa não muda e a comissão sai do ganho dos outros."
              : "Por mês, sai de dentro do lucro. Aparece em roxo na barra do ganho."
          }
        />
        {hasCommission && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>
                Comissão por mês{" "}
                {monthlyProfit > 0 && <span className="text-slate-400">{percent(commissionValue, monthlyProfit)} do lucro</span>}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <Label>Fica com</Label>
              <Select value={commissionTo} onChange={(e) => setCommissionTo(Number(e.target.value))}>
                {rows.map((r, i) => (
                  <option key={i} value={i}>
                    {r.name.trim() || `Pessoa ${i + 1}`}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-3 dark:border-white/5">
          <LoanBars people={people} />
        </div>

        {overLent && (
          <p className="flex gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-px shrink-0" />
            O que cada um emprestou soma {formatCurrency(lentSum)} — passa dos 100% ({formatCurrency(loanAmount)}).
          </p>
        )}
        {overProfit && (
          <p className="flex gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-px shrink-0" />
            Ganhos {commissionValue > 0 && "e comissão"} somam {formatCurrency(gainSum + commissionValue)} por mês — passa dos
            100% do lucro ({formatCurrency(monthlyProfit)}).
          </p>
        )}
        {!overLent && missingLent > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Faltam {formatCurrency(missingLent)} para fechar o valor emprestado.</p>
        )}
        {missingProfit > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Faltam {formatCurrency(missingProfit)} do lucro do mês para dividir.</p>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-white/5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>O dinheiro saiu de qual conta</Label>
            <Select value={outflowAccount} onChange={(e) => setOutflowAccount(Number(e.target.value))}>
              <option value={0}>Não registrar saída</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          {outflowAccount > 0 && (
            <div>
              <Label>Quanto saiu</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={outflowAmount ?? (myContribution ? String(myContribution) : "")}
                onChange={(e) => setOutflowAmount(e.target.value)}
              />
            </div>
          )}
        </div>
        {outflowAccount > 0 ? (
          loansPosition ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sai da conta e entra no patrimônio por {loansPosition.icon} {loansPosition.name}: não é gasto.
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Nenhuma posição está ligada aos Empréstimos: a saída conta como gasto do mês e o patrimônio cai. Para virar
              patrimônio, crie (ou edite) um ativo em Ativos com origem "Empréstimos".
            </p>
          )
        ) : (
          <p className="text-xs text-slate-400">Opcional: registre se o dinheiro saiu de uma conta sua agora.</p>
        )}
      </div>

      <div>
        <Label>Observação (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: cheque para 3 meses" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || blocked} title={blocked ? "Algum valor passa dos 100%" : undefined}>
          {initial ? "Salvar" : "Registrar empréstimo"}
        </Button>
      </div>
    </form>
  )
}
