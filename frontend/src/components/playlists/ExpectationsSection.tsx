import { useState } from "react"
import { Plus } from "lucide-react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Modal } from "../ui/Modal"
import { ExpectationForm } from "./ExpectationForm"
import { LaunchExpectationForm } from "./LaunchExpectationForm"
import { RenewExpectationForm } from "./RenewExpectationForm"
import { ExpectationRow } from "./ExpectationRow"
import { useExpectations, useExpectationMutations } from "../../hooks/useExpectations"
import { useFormSubmit } from "../../hooks/useFormSubmit"
import type { PlaylistExpectation } from "../../types"
import type { ExpectationInput, LaunchExpectationInput } from "../../api/expectations"

type ModalKind = "create" | "launch" | "renew" | null

export function ExpectationsSection({ playlistId }: { playlistId: number }) {
  const { data: expectations, isLoading } = useExpectations({ playlist_id: playlistId })
  const { create, update, remove, launch } = useExpectationMutations()

  const [modal, setModal] = useState<ModalKind>(null)
  const [active, setActive] = useState<PlaylistExpectation | undefined>()
  const form = useFormSubmit(() => setModal(null))

  const items = [...(expectations ?? [])].sort((a, b) =>
    a.expected_date.localeCompare(b.expected_date)
  )

  const handleCreate = (data: Omit<ExpectationInput, "playlist_id">) => {
    form.submit(create.mutateAsync({ ...data, playlist_id: playlistId }))
  }

  const handleLaunch = (data: LaunchExpectationInput) => {
    if (!active) return
    form.submit(launch.mutateAsync({ id: active.id, data }))
  }

  const handleRenew = (data: { expected_date: string; amount: number }) => {
    if (!active) return
    form.submit(update.mutateAsync({ id: active.id, data }))
  }

  const handleDelete = (expectation: PlaylistExpectation) => {
    if (window.confirm(`Excluir "${expectation.description}"?`)) {
      remove.mutate(expectation.id)
    }
  }

  const openModal = (kind: ModalKind, expectation?: PlaylistExpectation) => {
    form.reset()
    setActive(expectation)
    setModal(kind)
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Movimentos esperados
        </h3>
        <Button onClick={() => openModal("create")}>
          <Plus size={16} /> Nova expectativa
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nenhum movimento esperado ainda. Cadastre uma parcela ou cheque com data prevista —
          quando chegar a hora, clique em "Lançar" para lançar no caixa (pode clicar de novo no
          futuro, ela continua aqui) ou "Renovar" para empurrar a data.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((expectation) => (
            <ExpectationRow
              key={expectation.id}
              expectation={expectation}
              onLaunch={() => openModal("launch", expectation)}
              onRenew={() => openModal("renew", expectation)}
              onDelete={() => handleDelete(expectation)}
            />
          ))}
        </div>
      )}

      <Modal
        open={modal === "create"}
        onClose={() => setModal(null)}
        title="Nova expectativa"
        error={form.error}
      >
        <ExpectationForm
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          submitting={create.isPending}
        />
      </Modal>

      <Modal open={modal === "launch"} onClose={() => setModal(null)} title="Lançar" error={form.error}>
        {active && (
          <LaunchExpectationForm
            expectation={active}
            onSubmit={handleLaunch}
            onCancel={() => setModal(null)}
            submitting={launch.isPending}
          />
        )}
      </Modal>

      <Modal
        open={modal === "renew"}
        onClose={() => setModal(null)}
        title="Renovar"
        error={form.error}
      >
        {active && (
          <RenewExpectationForm
            expectation={active}
            onSubmit={handleRenew}
            onCancel={() => setModal(null)}
            submitting={update.isPending}
          />
        )}
      </Modal>
    </Card>
  )
}
