import { useState } from "react"
import { PiggyBank, Pencil, Plus, Trash2 } from "lucide-react"
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
import { useConfirm } from "../components/ui/ConfirmDialog"
import { formatCurrency } from "../lib/format"

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
  // -1 = separada; 0 = patrimônio total; outro = a posição.
  const [playlistId, setPlaylistId] = useState(initial?.saved_amount != null ? -1 : (initial?.playlist_id ?? 0))
  const [saved, setSaved] = useState(initial?.saved_amount != null ? String(initial.saved_amount) : "0")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          name,
          icon,
          target_amount: Number(target),
          deadline: deadline || null,
          playlist_id: playlistId > 0 ? playlistId : null,
          saved_amount: playlistId === -1 ? Number(saved) : null,
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
          <option value={-1}>Separada (eu informo quanto guardei)</option>
          {playlists?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-slate-400">
          {playlistId === -1
            ? "Não olha o patrimônio: só conta o que você disser que guardou para ela."
            : "A meta enche sozinha com o valor do que você escolher aqui — nada para lançar à parte."}
        </p>
      </div>
      {playlistId === -1 && (
        <div>
          <Label htmlFor="meta-guardado">Já guardado (R$)</Label>
          <Input
            id="meta-guardado"
            type="number"
            step="0.01"
            min="0"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
            required
          />
        </div>
      )}
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
  const ask = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))
  const [guardando, setGuardando] = useState<Goal | undefined>()

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
              Nenhuma meta ainda. Uma meta acompanha o patrimônio total, um ativo/grupo ou só o que
              você guardar para ela, e diz quanto guardar por mês para chegar lá no prazo.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <div className="mb-3 flex items-center justify-end gap-1">
                  {goal.saved_amount !== null && (
                    <Button variant="secondary" onClick={() => setGuardando(goal)} className="mr-auto px-3 py-1.5 text-xs">
                      <PiggyBank size={14} /> Guardar
                    </Button>
                  )}
                  <button
                    onClick={() => open(goal)}
                    aria-label="Editar meta"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() =>
                      ask({
                        title: "Excluir meta?",
                        message: `A meta "${goal.name}" será apagada.`,
                        consequences: ["Nada muda no patrimônio nem nas posições."],
                        action: () => remove.mutateAsync(goal.id),
                        done: "Meta excluída",
                      })
                    }
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

      {guardando && (
        <GuardarModal
          goal={guardando}
          onClose={() => setGuardando(undefined)}
          salvar={(saved_amount) =>
            update.mutateAsync({ id: guardando.id, data: { saved_amount } }).then(() => setGuardando(undefined))
          }
        />
      )}
    </>
  )
}

/** Meta separada: soma (ou tira) do que já foi guardado. */
function GuardarModal({
  goal,
  onClose,
  salvar,
}: {
  goal: Goal
  onClose: () => void
  salvar: (saved: number) => Promise<unknown>
}) {
  const [valor, setValor] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const atual = goal.saved_amount ?? 0

  const aplicar = (sinal: 1 | -1) => {
    const novo = Math.round((atual + sinal * Number(valor)) * 100) / 100
    if (!(Number(valor) > 0)) return setErro("Digite um valor maior que zero.")
    if (novo < 0) return setErro(`Só tem ${formatCurrency(atual)} guardado nessa meta.`)
    setSalvando(true)
    setErro(null)
    salvar(novo)
      .catch((err: Error) => setErro(err.message))
      .finally(() => setSalvando(false))
  }

  return (
    <Modal open onClose={onClose} title={`${goal.icon} ${goal.name}`} error={erro}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          aplicar(1)
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Guardado até agora: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(atual)}</strong> de{" "}
          {formatCurrency(goal.target_amount)}.
        </p>
        <div>
          <Label htmlFor="meta-valor">Valor (R$)</Label>
          <Input
            id="meta-valor"
            type="number"
            step="0.01"
            min="0.01"
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => aplicar(-1)} disabled={salvando}>
            Tirar
          </Button>
          <Button type="submit" disabled={salvando}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
