import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { IconPicker } from "../components/ui/IconPicker"
import { Input, Label, Select } from "../components/ui/Input"
import { GoalProgress } from "../components/goals/GoalProgress"
import { useGoals, useGoalMutations } from "../hooks/useGoals"
import { usePlaylists } from "../hooks/usePlaylists"
import { useFormSubmit } from "../hooks/useFormSubmit"
import type { Goal } from "../types"
import type { GoalInput } from "../api/goals"

function GoalForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Goal
  onSubmit: (data: GoalInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: playlists } = usePlaylists()
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? "🎯")
  const [target, setTarget] = useState(initial ? String(initial.target_amount) : "")
  const [deadline, setDeadline] = useState(initial?.deadline ?? "")
  const [playlistId, setPlaylistId] = useState(initial?.playlist_id ?? 0)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          name,
          icon,
          target_amount: Number(target),
          deadline: deadline || null,
          playlist_id: playlistId || null,
        })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Nome</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Reserva de emergência, Terminar a obra..."
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Quanto quer chegar (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Até quando (opcional)</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Acompanhar</Label>
        <Select value={playlistId} onChange={(e) => setPlaylistId(Number(e.target.value))}>
          <option value={0}>Patrimônio total</option>
          {playlists?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-slate-400">
          A meta enche sozinha com o valor do que você escolher aqui — nada para lançar à parte.
        </p>
      </div>
      <div>
        <Label>Ícone</Label>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {initial ? "Salvar" : "Criar meta"}
        </Button>
      </div>
    </form>
  )
}

export function Goals() {
  const { data: goals, isLoading } = useGoals()
  const { create, update, remove } = useGoalMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const open = (goal?: Goal) => {
    setEditing(goal)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: GoalInput) =>
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))

  return (
    <>
      <Topbar
        title="Metas"
        action={
          <Button onClick={() => open()}>
            <Plus size={16} /> Nova meta
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : !goals || goals.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhuma meta ainda. Uma meta acompanha o patrimônio total ou um ativo/grupo e diz
              quanto guardar por mês para chegar lá no prazo.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <div className="mb-3 flex items-center justify-end gap-1">
                  <button
                    onClick={() => open(goal)}
                    aria-label="Editar meta"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => confirm(`Excluir a meta "${goal.name}"?`) && remove.mutate(goal.id)}
                    aria-label="Excluir meta"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <GoalProgress goal={goal} />
              </Card>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar meta" : "Nova meta"}
        error={error}
      >
        <GoalForm
          key={editing?.id ?? "nova"}
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </>
  )
}
