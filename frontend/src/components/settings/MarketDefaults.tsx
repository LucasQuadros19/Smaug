import { useState, type ReactNode } from "react"
import { Card } from "../ui/Card"
import { Input, Label } from "../ui/Input"
import { SegmentedControl } from "../ui/SegmentedControl"
import { Toggle } from "../ui/Toggle"
import { useSettings } from "../../hooks/useMe"
import type { LoanSchedule, Settings } from "../../types"

type NumberKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings]

/** Campo numérico que só salva ao sair dele: digitar "1," não vira erro no meio do caminho. */
function NumberField({ field, label, hint, step = "0.01" }: { field: NumberKey; label: string; hint?: string; step?: string }) {
  const { settings, set } = useSettings()
  const [value, setValue] = useState(String(settings[field]))
  const save = () => {
    const parsed = Number(value)
    if (value === "" || Number.isNaN(parsed)) return setValue(String(settings[field]))
    if (parsed !== settings[field]) set({ [field]: parsed })
  }
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step} min="0" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
      {children}
    </div>
  )
}

/** Os padrões de mercado: o que já vem preenchido nos cadastros. */
export function MarketDefaults() {
  const { settings, set, error } = useSettings()
  return (
    <Card className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Padrões de mercado</h3>
        <p className="mt-1 text-xs text-slate-400">
          Valores que já vêm preenchidos nos cadastros. Mudar aqui não altera o que já foi registrado.
        </p>
        {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error.message}</p>}
      </div>

      <Section title="Empréstimos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField field="loan_rate" label="Taxa (% ao mês)" />
          <NumberField field="loan_months" label="Meses" step="1" />
          <NumberField field="grace_days" label="Tolerância (dias)" step="1" hint="Antes de cobrar atraso" />
          <NumberField field="late_fine" label="Multa por atraso (%)" hint="Padrão de mercado: 2%" />
          <NumberField field="late_interest" label="Mora (% ao mês)" hint="Padrão: 1% ao mês, por dia" />
        </div>
        <div>
          <Label>Como o dinheiro volta</Label>
          <SegmentedControl<LoanSchedule>
            ariaLabel="Como o dinheiro volta"
            value={settings.loan_schedule}
            onChange={(value) => set({ loan_schedule: value })}
            options={[
              { value: "interest_only", label: "Só juros por mês" },
              { value: "installments", label: "Parcelas" },
            ]}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={settings.postpone_charges}
            onChange={(value) => set({ postpone_charges: value })}
            label="Adiar cobra os juros do mês"
            hint="Desligado, adiar vira carência"
          />
          <Toggle
            checked={settings.business_days}
            onChange={(value) => set({ business_days: value })}
            label="Avisar vencimento fora do dia útil"
            hint="Fim de semana e feriado nacional"
          />
        </div>
      </Section>

      <Section title="Mercado">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField field="order_fee" label="Corretagem (R$ por ordem)" />
          <NumberField field="b3_fee" label="Taxas B3 (%)" step="0.001" hint="Emolumentos + liquidação" />
          <NumberField field="stock_tax" label="IR ações (%)" />
          <NumberField field="stock_exempt" label="Ações isentas até (R$ vendidos/mês)" />
          <NumberField field="crypto_tax" label="IR cripto (%)" />
          <NumberField field="crypto_exempt" label="Cripto isenta até (R$ vendidos/mês)" />
        </div>
      </Section>

    </Card>
  )
}
