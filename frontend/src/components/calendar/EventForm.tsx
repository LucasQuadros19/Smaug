import { useState } from "react"
import { Button } from "../ui/Button"
import { ColorPicker } from "../ui/ColorPicker"
import { Input, Label } from "../ui/Input"
import { SegmentedControl } from "../ui/SegmentedControl"
import type { CalendarEventInput } from "../../api/calendar"
import type { CalendarEvent } from "../../types"

type Direction = "none" | "in" | "out"

export function EventForm({
  initial,
  defaultDate,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: CalendarEvent
  defaultDate: string
  onSubmit: (data: CalendarEventInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "")
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "none")
  const [color, setColor] = useState(initial?.color ?? "#8b5cf6")
  const [notes, setNotes] = useState(initial?.notes ?? "")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title,
          date,
          amount: amount === "" ? null : Number(amount),
          direction: direction === "none" ? null : direction,
          color,
          notes: notes || null,
        })
      }}
      className="space-y-4"
    >
      <div>
        <Label>O que é</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: IPVA, aniversário da Ana" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Dia</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Valor (opcional)</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </div>
      </div>
      <div>
        <Label>Tipo</Label>
        <SegmentedControl<Direction>
          ariaLabel="Tipo do evento"
          value={direction}
          onChange={setDirection}
          options={[
            { value: "none", label: "Lembrete" },
            { value: "in", label: "Entrada" },
            { value: "out", label: "Saída" },
          ]}
        />
      </div>
      <div>
        <Label>Cor</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div>
        <Label>Observação (opcional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {initial ? "Salvar" : "Criar evento"}
        </Button>
      </div>
    </form>
  )
}
