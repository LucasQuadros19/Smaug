import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { Toggle } from "../ui/Toggle"
import { LoanBars } from "./LoanBars"
import { formatCurrency, todayISO } from "../../lib/format"
import type { Loan, LoanStatus } from "../../types"
import type { LoanInput, LoanParticipantInput } from "../../api/loans"

const STATUS_LABELS: Record<LoanStatus, string> = {
  active: "Em aberto",
  paid: "Quitado",
  late: "Atrasado",
}

function emptyParticipant(isMe = false): LoanParticipantInput {
  return { name: isMe ? "Eu" : "", contributed: 0, to_receive: 0, commission: 0, is_me: isMe }
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
  const [borrower, setBorrower] = useState(initial?.borrower ?? "")
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
  const [rate, setRate] = useState(initial?.interest_rate != null ? String(initial.interest_rate) : "")
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO())
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "")
  const [status, setStatus] = useState<LoanStatus>(initial?.status ?? "active")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [participants, setParticipants] = useState<LoanParticipantInput[]>(
    initial && initial.participants.length > 0
      ? initial.participants.map((p) => ({
          name: p.name,
          contributed: p.contributed,
          to_receive: p.to_receive,
          commission: 0,
          is_me: p.is_me,
        }))
      : [emptyParticipant(true)]
  )
  // A comissão é de uma pessoa só, escolhida na lista.
  const initialCommissionIndex = initial?.participants.findIndex((p) => p.commission > 0) ?? -1
  const [hasCommission, setHasCommission] = useState(initialCommissionIndex >= 0)
  const [commission, setCommission] = useState(
    initialCommissionIndex >= 0 ? String(initial!.participants[initialCommissionIndex].commission) : ""
  )
  const [commissionTo, setCommissionTo] = useState(Math.max(initialCommissionIndex, 0))

  const patch = (index: number, changes: Partial<LoanParticipantInput>) =>
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...changes } : p)))

  const removeParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, i) => i !== index))
    if (index < commissionTo) setCommissionTo(commissionTo - 1)
    else if (index === commissionTo) setCommissionTo(0)
  }

  const withCommission = participants.map((p, i) => ({
    ...p,
    contributed: Number(p.contributed) || 0,
    to_receive: Number(p.to_receive) || 0,
    commission: hasCommission && i === commissionTo ? Number(commission) || 0 : 0,
  }))
  const totalContributed = withCommission.reduce((s, p) => s + p.contributed, 0)
  const totalToReceive = withCommission.reduce((s, p) => s + p.to_receive + p.commission, 0)
  const loanAmount = Number(amount) || 0
  const mismatch = loanAmount > 0 && Math.abs(totalContributed - loanAmount) > 0.009

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          borrower,
          amount: loanAmount,
          interest_rate: rate === "" ? null : Number(rate),
          start_date: startDate,
          due_date: dueDate || null,
          status,
          notes: notes || null,
          participants: withCommission
            .filter((p) => p.name.trim())
            .map((p) => ({ ...p, name: p.name.trim() })),
        })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Para quem emprestou</Label>
          <Input
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
            placeholder="Nome da pessoa"
            required
          />
        </div>
        <div>
          <Label>Valor total emprestado</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Porcentagem (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Ex: 5"
          />
        </div>
        <div>
          <Label>Quando emprestou</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Previsão de retorno</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
            <p className="text-xs text-slate-400">
              Digite quanto cada um emprestou e quanto cada um recebe de volta.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setParticipants((prev) => [...prev, emptyParticipant()])}
          >
            <Plus size={15} /> Pessoa
          </Button>
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1fr_4.5rem] gap-2 px-2 text-[11px] text-slate-400 sm:grid">
            <span>Nome</span>
            <span>Emprestou</span>
            <span>Recebe</span>
          </div>
          {participants.map((participant, index) => (
            <div
              key={index}
              className={clsx(
                "grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[3fr_4.5rem]",
                participant.is_me
                  ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/20 dark:bg-indigo-500/5"
                  : "border-slate-100 dark:border-white/5"
              )}
            >
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={participant.name}
                  onChange={(e) => patch(index, { name: e.target.value })}
                  placeholder="Nome"
                  aria-label="Nome"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={participant.contributed || ""}
                  onChange={(e) => patch(index, { contributed: Number(e.target.value) })}
                  placeholder="Emprestou"
                  aria-label="Emprestou"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={participant.to_receive || ""}
                  onChange={(e) => patch(index, { to_receive: Number(e.target.value) })}
                  placeholder="Recebe"
                  aria-label="Recebe"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="flex cursor-pointer items-center gap-1 px-1 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={participant.is_me}
                    onChange={(e) => patch(index, { is_me: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 dark:border-white/20 dark:bg-white/5"
                  />
                  eu
                </label>
                <button
                  type="button"
                  onClick={() => removeParticipant(index)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  aria-label="Remover pessoa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Toggle
          checked={hasCommission}
          onChange={setHasCommission}
          label="Tem comissão"
          hint="Um valor a mais, por cima do que a pessoa recebe. Aparece em roxo na barra de quem recebe."
        />
        {hasCommission && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor da comissão</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="Ex: 300"
              />
            </div>
            <div>
              <Label>Fica com</Label>
              <Select value={commissionTo} onChange={(e) => setCommissionTo(Number(e.target.value))}>
                {participants.map((p, i) => (
                  <option key={i} value={i}>
                    {p.name.trim() || `Pessoa ${i + 1}`}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-3 dark:border-white/5">
          <LoanBars people={withCommission} />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">Somado do que emprestaram</p>
            <p
              className={clsx(
                "font-semibold",
                mismatch ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-100"
              )}
            >
              {formatCurrency(totalContributed)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total a receber</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalToReceive)}
            </p>
          </div>
        </div>
        {mismatch && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            A soma do que emprestaram ({formatCurrency(totalContributed)}) está diferente do valor
            emprestado ({formatCurrency(loanAmount)}). Só um aviso — dá para salvar assim mesmo.
          </p>
        )}
      </div>

      <div>
        <Label>Observação (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: cheque para 3 meses"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {initial ? "Salvar" : "Registrar empréstimo"}
        </Button>
      </div>
    </form>
  )
}
