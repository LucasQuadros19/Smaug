import { useState } from "react"
import { Plus } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Modal } from "../components/ui/Modal"
import { AssetForm, type AssetInitialEntry } from "../components/playlists/AssetForm"
import { PlaylistCard } from "../components/playlists/PlaylistCard"
import { usePlaylists, usePlaylistMutations } from "../hooks/usePlaylists"
import { useTransactionMutations } from "../hooks/useTransactions"
import { useFormSubmit } from "../hooks/useFormSubmit"
import type { Playlist } from "../types"
import type { PlaylistInput } from "../api/playlists"

export function Assets() {
  const { data: playlists, isLoading } = usePlaylists()
  const { create, update, remove } = usePlaylistMutations()
  const { create: createTransaction } = useTransactionMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Playlist | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (asset: Playlist) => {
    setEditing(asset)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = async (data: PlaylistInput, initialEntry?: AssetInitialEntry) => {
    const action = async () => {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data })
        return
      }
      const asset = await create.mutateAsync(data)
      if (initialEntry) {
        await createTransaction.mutateAsync({
          description: `Aporte inicial - ${asset.name}`,
          account_id: initialEntry.account_id,
          category_id: null,
          playlist_id: asset.id,
          amount: initialEntry.amount,
          type: "expense",
          date: initialEntry.date,
        })
      }
    }
    submit(action())
  }

  const handleDelete = (asset: Playlist) => {
    if (
      confirm(
        `Excluir o ativo "${asset.name}"? As transações já lançadas continuam no caixa geral, apenas deixam de estar agrupadas nele.`
      )
    ) {
      remove.mutate(asset.id)
    }
  }

  const assets = playlists?.filter((p) => p.kind === "asset") ?? []

  return (
    <>
      <Topbar
        title="Ativos"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Novo ativo
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nenhum ativo cadastrado ainda. Use Ativos para empréstimos, investimentos e obra —
            dinheiro que sai do caixa mas continua seu. Ele conta no patrimônio total e fica de
            fora de Despesas/Receitas do mês.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <PlaylistCard
                key={asset.id}
                playlist={asset}
                onEdit={() => openEdit(asset)}
                onDelete={() => handleDelete(asset)}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar ativo" : "Novo ativo"}
        error={error}
      >
        <AssetForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending || createTransaction.isPending}
        />
      </Modal>
    </>
  )
}
