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
import { useConfirm } from "../../components/ui/ConfirmDialog"

type ModalKind = "create" | "launch" | "renew" | null

export function ExpectationsSection({ playlistId }: { playlistId: number }) {
  const { data: expectations, isLoading } = useExpectations({ playlist_id: playlistId })
  const { create, update, remove, launch } = useExpectationMutations()
  const ask = useConfirm()

  const [modal, setModal] = useState<ModalKind>(null)
  const [active, setActive] = useState<PlaylistExpectation | undefined>()
  const form = useFormSubmit(() => setModal(null))

  const sorted = [...(expectations ?? [])].sort((a, b) => a.expected_date.localeCompare(b.expected_date))
  const items = sorted.filter((e) => e.status === "pending")
  const closed = sorted.filter((e) => e.status !== "pending")

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

  const handleDelete = (expectation: PlaylistExpectation) =>
    ask({
      title: "Excluir previsão?",
      message: `"${expectation.description}" sai da lista de esperados.`,
      consequences: ["O que já foi lançado no caixa continua."],
      action: () => remove.mutateAsync(expectation.id),
      done: "Previsão excluída",
    })

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
      ) : items.length === 0 && closed.length === 0 ? (
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
          {closed.length > 0 && (
            <details className="pt-1 text-sm">
              <summary className="cursor-pointer text-xs text-slate-400">Encerradas ({closed.length})</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {closed.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span>{e.description}</span>
                    <button
                      onClick={() => handleDelete(e)}
                      className="text-slate-300 hover:text-rose-500 dark:text-slate-600"
                      aria-label="Excluir"
                    >
                      excluir
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
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
