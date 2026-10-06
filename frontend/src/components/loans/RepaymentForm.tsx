import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { Toggle } from "../ui/Toggle"
import { useAccounts } from "../../hooks/useAccounts"
import { formatCurrency, todayISO } from "../../lib/format"
import type { Loan } from "../../types"
import type { RepaymentInput } from "../../api/loans"

export function RepaymentForm({
  loan,
  onSubmit,
  onCancel,
  submitting,
}: {
  loan: Loan
  onSubmit: (data: RepaymentInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: accounts } = useAccounts()

  const [amount, setAmount] = useState("")
  const [myShare, setMyShare] = useState("")
  const [partnersShare, setPartnersShare] = useState("")
  const [accountId, setAccountId] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [notes, setNotes] = useState("")

  const hasPartners = loan.participants.some((p) => !p.is_me)
  // Proporção do que eu recebo (inclui comissão), só como sugestão ao digitar.
  // Sem "recebe" preenchido, cai na proporção do que cada um colocou.
  const myRatio =
    loan.total_to_receive > 0
      ? (loan.my_to_receive ?? 0) / loan.total_to_receive
      : loan.total_contributed > 0
        ? (loan.my_contributed ?? 0) / loan.total_contributed
        : 1

  const total = Number(amount) || 0
  const mine = Number(myShare) || 0
  const partners = Number(partnersShare) || 0
  const unassigned = total - mine - partners

  /** Ao digitar o total, propõe o rateio na mesma proporção da entrada. */
  const handleAmount = (value: string) => {
    setAmount(value)
    const parsed = Number(value) || 0
    if (!hasPartners) {
      setMyShare(value)
      setPartnersShare("")
      return
    }
    const suggested = Math.round(parsed * myRatio * 100) / 100
    setMyShare(String(suggested))
    setPartnersShare(String(Math.round((parsed - suggested) * 100) / 100))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          date,
          amount: total,
          my_share: mine,
          partners_share: partners,
          account_id: accountId,
          partners_settled: alreadyPaid,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-6 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/[0.03]">
        <div>
          <p className="text-xs text-slate-400">Meu dinheiro na rua</p>
          <p className="font-semibold text-slate-900 dark:text-white">
            {formatCurrency(loan.my_outstanding)}
          </p>
        </div>
        {loan.my_repaid > 0 && (
          <div>
            <p className="text-xs text-slate-400">Já voltou</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(loan.my_repaid)}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quanto entrou na conta</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => handleAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      {hasPartners && (
        <div className="space-y-3 rounded-xl border border-slate-100 p-3 dark:border-white/5">
          <p className="text-xs text-slate-400">
            Desse valor, quanto é seu e quanto é dos sócios. Os campos vêm sugeridos na proporção
            da entrada — ajuste como quiser.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Minha parte</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={myShare}
                onChange={(e) => setMyShare(e.target.value)}
              />
            </div>
            <div>
              <Label>Parte dos sócios</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={partnersShare}
                onChange={(e) => setPartnersShare(e.target.value)}
              />
            </div>
          </div>
          {Math.abs(unassigned) > 0.009 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {unassigned > 0
                ? `Sobrou ${formatCurrency(unassigned)} sem dono.`
                : `As partes passam ${formatCurrency(-unassigned)} do total recebido.`}
            </p>
          )}
          {partners > 0 && (
            <Toggle
              checked={alreadyPaid}
              onChange={setAlreadyPaid}
              label="Já repassei aos sócios"
              hint="Se ainda não repassou, o dinheiro deles fica no seu caixa mas sai do seu patrimônio — e você marca o repasse depois."
            />
          )}
        </div>
      )}

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

      <div>
        <Label>Observação (opcional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: 1ª parcela"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || !accountId || total <= 0 || unassigned < -0.009}>
          Registrar recebimento
        </Button>
      </div>
    </form>
  )
}
