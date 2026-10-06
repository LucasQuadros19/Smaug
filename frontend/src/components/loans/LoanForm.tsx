import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { formatCurrency, todayISO } from "../../lib/format"
import type { Loan, LoanStatus } from "../../types"
import type { LoanInput, LoanParticipantInput } from "../../api/loans"

const STATUS_LABELS: Record<LoanStatus, string> = {
  active: "Em aberto",
  paid: "Quitado",
  late: "Atrasado",
}

function emptyParticipant(isMe = false): LoanParticipantInput {
  return { name: isMe ? "Eu" : "", contributed: 0, to_receive: 0, is_me: isMe }
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
          is_me: p.is_me,
        }))
      : [emptyParticipant(true)]
  )

  const patch = (index: number, changes: Partial<LoanParticipantInput>) =>
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...changes } : p)))

  const totalContributed = participants.reduce((s, p) => s + (Number(p.contributed) || 0), 0)
  const totalToReceive = participants.reduce((s, p) => s + (Number(p.to_receive) || 0), 0)
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
          participants: participants
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              contributed: Number(p.contributed) || 0,
              to_receive: Number(p.to_receive) || 0,
              is_me: p.is_me,
            })),
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Quem entrou com dinheiro
            </p>
            <p className="text-xs text-slate-400">
              Todos os valores são digitados por você — o app não calcula nada.
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
          {participants.map((participant, index) => (
            <div
              key={index}
              className={clsx(
                "grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2",
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
                />
                <Input
                  type="number"
                  step="0.01"
                  value={participant.contributed || ""}
                  onChange={(e) => patch(index, { contributed: Number(e.target.value) })}
                  placeholder="Entrou com"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={participant.to_receive || ""}
                  onChange={(e) => patch(index, { to_receive: Number(e.target.value) })}
                  placeholder="Recebe"
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
                  onClick={() => setParticipants((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  aria-label="Remover pessoa"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-sm dark:border-white/5">
          <div>
            <p className="text-xs text-slate-400">Somado dos participantes</p>
            <p
              className={clsx(
                "font-semibold",
                mismatch
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-800 dark:text-slate-100"
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
            A soma dos participantes ({formatCurrency(totalContributed)}) está diferente do valor
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
