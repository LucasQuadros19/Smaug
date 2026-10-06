import { useState } from "react"
import { ArrowLeft, Pencil, Plus } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { TransactionForm } from "../components/transactions/TransactionForm"
import { TransactionTable } from "../components/transactions/TransactionTable"
import { PlaylistForm } from "../components/playlists/PlaylistForm"
import { AssetForm } from "../components/playlists/AssetForm"
import { ExpectationsSection } from "../components/playlists/ExpectationsSection"
import { PositionTimeline } from "../components/playlists/PositionTimeline"
import { ShoppingListSection } from "../components/shopping/ShoppingListSection"
import { usePlaylist, usePlaylistMutations } from "../hooks/usePlaylists"
import { usePositionHistory } from "../hooks/usePositionHistory"
import { useTransactions, useTransactionMutations } from "../hooks/useTransactions"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { formatCurrency } from "../lib/format"
import { getAssetOutstanding, getTotalInvested, isDeclaredValue } from "../lib/asset"
import type { Transaction } from "../types"
import type { TransactionInput } from "../api/transactions"
import type { PlaylistInput } from "../api/playlists"

export function PlaylistDetail() {
  const { id } = useParams()
  const playlistId = Number(id)
  const navigate = useNavigate()

  const { data: playlist, isLoading: loadingPlaylist } = usePlaylist(playlistId)
  const { data: history } = usePositionHistory(playlistId)
  const { data: txPage, isLoading: loadingTx } = useTransactions({
    playlist_id: playlistId,
    per_page: 100,
  })
  const transactions = txPage?.items
  const { create, update, remove } = useTransactionMutations()
  const { update: updatePlaylist, remove: removePlaylist } = usePlaylistMutations()

  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | undefined>()
  const txForm = useFormSubmit(() => setTxModalOpen(false))

  const [editPlaylistOpen, setEditPlaylistOpen] = useState(false)
  const playlistForm = useFormSubmit(() => setEditPlaylistOpen(false))

  if (loadingPlaylist || !playlist) {
    return (
      <>
        <Topbar title="Grupo" />
        <main className="flex-1 p-4 sm:p-6">
          <p className="text-sm text-slate-400">Carregando...</p>
        </main>
      </>
    )
  }

  const openCreateTx = () => {
    setEditingTx(undefined)
    txForm.reset()
    setTxModalOpen(true)
  }
  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx)
    txForm.reset()
    setTxModalOpen(true)
  }
  const handleSubmitTx = (data: TransactionInput) => {
    txForm.submit(
      editingTx ? update.mutateAsync({ id: editingTx.id, data }) : create.mutateAsync(data)
    )
  }
  const handleDeleteTx = (tx: Transaction) => {
    if (confirm(`Excluir a transação "${tx.description}"?`)) {
      remove.mutate(tx.id)
    }
  }

  const handleSubmitPlaylist = (data: PlaylistInput) => {
    playlistForm.submit(updatePlaylist.mutateAsync({ id: playlist.id, data }))
  }

  const isAsset = playlist.kind === "asset"
  const listPath = isAsset ? "/ativos" : "/grupos"

  const handleDeletePlaylist = () => {
    if (
      confirm(
        `Excluir ${isAsset ? "o ativo" : "o grupo"} "${playlist.name}"? As transações já lançadas continuam no caixa geral, apenas deixam de estar agrupadas nele.`
      )
    ) {
      removePlaylist.mutate(playlist.id, { onSuccess: () => navigate(listPath) })
    }
  }

  const { outstanding, isProfit, isLiability, profit } = getAssetOutstanding(playlist)
  const declarado = isDeclaredValue(playlist)

  return (
    <>
      <Topbar
        title={`${playlist.icon} ${playlist.name}`}
        action={
          <Button onClick={openCreateTx}>
            <Plus size={16} /> Nova entrada
          </Button>
        }
      />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        <Link
          to={listPath}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Voltar para {isAsset ? "ativos" : "grupos"}
        </Link>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {playlist.description && (
                <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                  {playlist.description}
                </p>
              )}
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-slate-400">
                    {isProfit
                      ? "Lucro realizado"
                      : isLiability
                        ? "Dívida"
                        : declarado
                          ? "Valor de mercado"
                          : isAsset
                            ? "Em aberto"
                            : "Valor parado aqui"}
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      isProfit
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isLiability
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {formatCurrency(isProfit ? profit : outstanding)}
                  </p>
                </div>
                {/* Em valor declarado, "aportado/recebido" não descreve nada:
                    o que existe é quanto a coisa já custou e quanto rendeu. */}
                <div>
                  <p className="text-xs text-slate-400">
                    {declarado ? "Já gastei com ela" : "Aportado"}
                  </p>
                  <p
                    className={`text-lg font-medium ${
                      declarado
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {formatCurrency(declarado ? (playlist.total_out ?? 0) : getTotalInvested(playlist))}
                  </p>
                  {!declarado && playlist.opening_value > 0 && (
                    <p className="text-[11px] text-slate-400">
                      inclui {formatCurrency(playlist.opening_value)} declarado
                    </p>
                  )}
                  {declarado && (
                    <p className="text-[11px] text-slate-400">não altera o valor</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    {declarado ? "Já rendeu" : "Recebido"}
                  </p>
                  <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(playlist.total_in ?? 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  playlistForm.reset()
                  setEditPlaylistOpen(true)
                }}
              >
                <Pencil size={15} /> Editar
              </Button>
              <Button variant="danger" onClick={handleDeletePlaylist}>
                Excluir
              </Button>
            </div>
          </div>
        </Card>

        {history && <PositionTimeline history={history} />}

        {isAsset && <ExpectationsSection playlistId={playlist.id} />}

        <ShoppingListSection playlistId={playlist.id} />

        {loadingTx ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <TransactionTable
            transactions={transactions ?? []}
            onEdit={openEditTx}
            onDelete={handleDeleteTx}
            showPlaylist={false}
          />
        )}
      </main>

      <Modal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title={editingTx ? "Editar entrada" : "Nova entrada"}
        error={txForm.error}
      >
        <TransactionForm
          initial={editingTx}
          lockedPlaylistId={playlist.id}
          onSubmit={handleSubmitTx}
          onCancel={() => setTxModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>

      <Modal
        open={editPlaylistOpen}
        onClose={() => setEditPlaylistOpen(false)}
        title={isAsset ? "Editar ativo" : "Editar grupo"}
        error={playlistForm.error}
      >
        {isAsset ? (
          <AssetForm
            initial={playlist}
            onSubmit={handleSubmitPlaylist}
            onCancel={() => setEditPlaylistOpen(false)}
            submitting={updatePlaylist.isPending}
          />
        ) : (
          <PlaylistForm
            initial={playlist}
            onSubmit={handleSubmitPlaylist}
            onCancel={() => setEditPlaylistOpen(false)}
            submitting={updatePlaylist.isPending}
          />
        )}
      </Modal>
    </>
  )
}
