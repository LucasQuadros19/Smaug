import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Modal } from "../components/ui/Modal"
import { PlaylistForm } from "../components/playlists/PlaylistForm"
import { PlaylistCard } from "../components/playlists/PlaylistCard"
import { usePlaylists, usePlaylistMutations } from "../hooks/usePlaylists"
import { useFormSubmit } from "../hooks/useFormSubmit"
import type { Playlist } from "../types"
import type { PlaylistInput } from "../api/playlists"
import { useConfirm } from "../components/ui/ConfirmDialog"

export function Playlists() {
  const { data: playlists, isLoading } = usePlaylists()
  const { create, update, remove } = usePlaylistMutations()
  const ask = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Playlist | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (playlist: Playlist) => {
    setEditing(playlist)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: PlaylistInput) => {
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))
  }

  const handleDelete = (playlist: Playlist) =>
    ask({
      title: "Excluir grupo?",
      message: `O grupo "${playlist.name}" será apagado.`,
      consequences: [
        "Os lançamentos continuam no caixa; só deixam de estar marcados aqui.",
        "Se estiver na Evolução, o sistema não deixa: desligue \"Contar no patrimônio\" ou zere o valor.",
      ],
      action: () => remove.mutateAsync(playlist.id),
      done: "Grupo excluído",
    })

  const groups = playlists?.filter((p) => p.kind === "group") ?? []

  return (
    <>
      <Topbar
        title="Grupos"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo grupo
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nenhum grupo criado ainda. Use grupos para agrupar transações de algo
            específico — tipo "Moto" ou "Viagem" — e acompanhar depois. Para empréstimos,
            investimentos e obra, use a aba Ativos.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onEdit={() => openEdit(playlist)}
                onDelete={() => handleDelete(playlist)}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar grupo" : "Novo grupo"}
        error={error}
      >
        <PlaylistForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </>
  )
}
