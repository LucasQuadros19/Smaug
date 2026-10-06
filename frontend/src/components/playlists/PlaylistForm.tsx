import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label } from "../ui/Input"
import { ColorPicker } from "../ui/ColorPicker"
import { IconPicker } from "../ui/IconPicker"
import { Toggle } from "../ui/Toggle"
import type { Playlist } from "../../types"
import type { PlaylistInput } from "../../api/playlists"

export function PlaylistForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Playlist
  onSubmit: (data: PlaylistInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [color, setColor] = useState(initial?.color ?? "#8b5cf6")
  const [icon, setIcon] = useState(initial?.icon ?? "📁")
  const [countsInNetWorth, setCountsInNetWorth] = useState(initial?.counts_in_net_worth ?? false)
  const [openingValue, setOpeningValue] = useState(
    initial && initial.opening_value > 0 ? String(initial.opening_value) : ""
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          name,
          description: description || null,
          color,
          icon,
          kind: "group",
          counts_in_net_worth: countsInNetWorth,
          opening_value: Number(openingValue) || 0,
        })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nome</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Roupas, Viagem, Reforma..."
          required
        />
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Do que se trata"
        />
      </div>
      <div>
        <Label>Ícone</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div>
        <Label>Cor</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <Toggle
        checked={countsInNetWorth}
        onChange={setCountsInNetWorth}
        label="Contar no patrimônio total"
        hint="Grupos são consumo (roupas, viagem) — o dinheiro foi embora, então normalmente fica desligado. Ligue se o que você comprou ainda vale e pode ser vendido."
      />

      {countsInNetWorth && (
        <div>
          <Label>Valor que você já tem aqui (opcional)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={openingValue}
            onChange={(e) => setOpeningValue(e.target.value)}
            placeholder="0,00"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Entra no patrimônio sem debitar nenhuma conta — é o que já era seu antes de começar a
            registrar aqui.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {initial ? "Salvar" : "Criar grupo"}
        </Button>
      </div>
    </form>
  )
}
