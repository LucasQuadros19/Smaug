import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { RecurringForm } from "../components/recurring/RecurringForm"
import { RecurringRow } from "../components/recurring/RecurringRow"
import { LaunchRecurringForm } from "../components/recurring/LaunchRecurringForm"
import { useRecurring, useRecurringMutations } from "../hooks/useRecurring"
import { Input, Label } from "../components/ui/Input"
import { formatDate } from "../lib/format"
import { useFormSubmit } from "../hooks/useFormSubmit"
import type { RecurringTransaction } from "../types"
import type { LaunchRecurringInput, RecurringInput } from "../api/recurring"

/** "YYYY-MM-DD" + n dias, sem fuso: o vencimento é uma data, não um instante. */
function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function PostponeForm({
  item,
  onSubmit,
  onCancel,
  submitting,
}: {
  item: RecurringTransaction
  onSubmit: (until: string | null) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [until, setUntil] = useState(item.postponed_until ?? addDays(item.next_due_date, 7))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(until)
      }}
      className="space-y-4"
    >
      <p className="text-xs text-slate-400">
        Vale só para esta ocorrência (vencimento original {formatDate(item.next_due_date)}).{" "}
        {item.auto
          ? "A transação automática só é gerada na nova data."
          : "Ela só volta a aparecer como pendente na nova data."}{" "}
        Depois de lançada, a próxima segue o calendário normal.
      </p>
      <div className="flex flex-wrap gap-2">
        {[3, 7, 15, 30].map((days) => (
          <Button key={days} type="button" variant="secondary" onClick={() => setUntil(addDays(item.next_due_date, days))}>
            +{days} dias
          </Button>
        ))}
      </div>
      <div>
        <Label>Nova data</Label>
        <Input
          type="date"
          value={until}
          min={addDays(item.next_due_date, 1)}
          onChange={(e) => setUntil(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {item.postponed_until && (
          <Button type="button" variant="ghost" onClick={() => onSubmit(null)} disabled={submitting}>
            Desfazer adiamento
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          Adiar
        </Button>
      </div>
    </form>
  )
}

export function Recurring() {
  const { data: items, isLoading } = useRecurring()
  const { create, update, remove, generate, launch, postpone } = useRecurringMutations()
  const [postponing, setPostponing] = useState<RecurringTransaction | undefined>()
  const adiamento = useFormSubmit(() => setPostponing(undefined))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | undefined>()
  const [launching, setLaunching] = useState<RecurringTransaction | undefined>()
  const { submit, error, reset } = useFormSubmit(() => setModalOpen(false))
  const lancamento = useFormSubmit(() => setLaunching(undefined))

  const openCreate = () => {
    setEditing(undefined)
    reset()
    setModalOpen(true)
  }
  const openEdit = (item: RecurringTransaction) => {
    setEditing(item)
    reset()
    setModalOpen(true)
  }

  const handleSubmit = (data: RecurringInput) => {
    submit(editing ? update.mutateAsync({ id: editing.id, data }) : create.mutateAsync(data))
  }

  const openLaunch = (item: RecurringTransaction) => {
    lancamento.reset()
    setLaunching(item)
  }

  const handleLaunch = (data: LaunchRecurringInput) => {
    if (launching) lancamento.submit(launch.mutateAsync({ id: launching.id, data }))
  }

  const handleDelete = (item: RecurringTransaction) => {
    if (confirm(`Excluir a recorrência "${item.description}"?`)) {
      remove.mutate(item.id)
    }
  }

  return (
    <>
      <Topbar
        title="Recorrentes"
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <RefreshCw size={16} /> Gerar pendentes
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Nova recorrência
            </Button>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : !items || items.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma recorrência cadastrada.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-white/5">
                  <th className="px-5 py-3 font-medium">Descrição</th>
                  <th className="px-5 py-3 font-medium">Conta</th>
                  <th className="px-5 py-3 font-medium">Frequência</th>
                  <th className="px-5 py-3 font-medium">Próximo</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Modo</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {items.map((item) => (
                  <RecurringRow
                    key={item.id}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item)}
                    onToggleActive={() => update.mutate({ id: item.id, data: { active: !item.active } })}
                    onToggleAuto={() => update.mutate({ id: item.id, data: { auto: !item.auto } })}
                    onLaunch={() => openLaunch(item)}
                    onPostpone={() => {
                      adiamento.reset()
                      setPostponing(item)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      <Modal
        open={Boolean(launching)}
        onClose={() => setLaunching(undefined)}
        title={`Lançar ${launching?.description ?? ""}`}
        error={lancamento.error}
      >
        {launching && (
          <LaunchRecurringForm
            item={launching}
            onSubmit={handleLaunch}
            onCancel={() => setLaunching(undefined)}
            submitting={launch.isPending}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(postponing)}
        onClose={() => setPostponing(undefined)}
        title={`Adiar ${postponing?.description ?? ""}`}
        error={adiamento.error}
      >
        {postponing && (
          <PostponeForm
            item={postponing}
            onSubmit={(until) => adiamento.submit(postpone.mutateAsync({ id: postponing.id, until }))}
            onCancel={() => setPostponing(undefined)}
            submitting={postpone.isPending}
          />
        )}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar recorrência" : "Nova recorrência"}
        error={error}
      >
        <RecurringForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          submitting={create.isPending || update.isPending}
        />
      </Modal>
    </>
  )
}
