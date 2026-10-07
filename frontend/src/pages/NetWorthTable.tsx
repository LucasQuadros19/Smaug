import { useState } from "react"
import { ArrowLeftRight, Banknote, Download, PiggyBank, Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { SnapshotForm } from "../components/snapshots/SnapshotForm"
import { TransferForm } from "../components/snapshots/TransferForm"
import { SettleForm } from "../components/snapshots/SettleForm"
import { InvestForm } from "../components/snapshots/InvestForm"
import { Pagination } from "../components/ui/Pagination"
import { useSnapshots, useSnapshotMutations } from "../hooks/useSnapshots"
import { usePlaylists } from "../hooks/usePlaylists"
import { useAccounts } from "../hooks/useAccounts"
import { useViewing } from "../lib/viewing"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { formatCurrency, formatDate, formatMoney } from "../lib/format"
import type { Snapshot } from "../types"
import type { SnapshotInput } from "../api/snapshots"

/** Zero fica apagado para a tabela não virar um muro de números. Em outra
 *  moeda mostra o valor como você digitou (US$, BTC) e os reais no hover. */
function Money({
  value,
  muted,
  native,
  currency,
}: {
  value: number
  muted?: boolean
  native?: number
  currency?: string
}) {
  if (value === 0) return <span className="text-slate-300 dark:text-slate-600">—</span>
  const showNative = native !== undefined && currency && currency !== "BRL"
  return (
    <span
      title={showNative ? formatCurrency(value) : undefined}
      className={clsx(
        value < 0
          ? "text-rose-600 dark:text-rose-400"
          : muted
            ? "text-slate-500 dark:text-slate-400"
            : "text-slate-800 dark:text-slate-100"
      )}
    >
      {showNative ? formatMoney(native, currency) : formatCurrency(value)}
    </span>
  )
}

export function NetWorthTable() {
  const [page, setPage] = useState(1)
  const { data: result, isLoading } = useSnapshots({ page, per_page: 30 })
  const snapshots = result?.items
  const { data: playlists } = usePlaylists()
  const { data: accounts } = useAccounts()
  const viewing = useViewing()
  const { create, transfer, settle, invest, remove } = useSnapshotMutations()
  const [modal, setModal] = useState<"record" | "transfer" | "settle" | "invest" | null>(null)
  const { submit, error, reset } = useFormSubmit(() => setModal(null))

  const openModal = (kind: "record" | "transfer" | "settle" | "invest") => {
    reset()
    setModal(kind)
  }

  const positions = playlists?.filter((p) => p.kind === "asset") ?? []
  const cashAccounts = accounts ?? []

  const handleSubmit = (data: SnapshotInput) => submit(create.mutateAsync(data))

  const handleDelete = (snapshot: Snapshot) => {
    if (
      confirm(
        `Excluir o registro de ${formatDate(snapshot.date)}? Isso remove só a linha do histórico, não muda o patrimônio atual.`
      )
    ) {
      remove.mutate(snapshot.id)
    }
  }

  const latest = snapshots?.[0]

  return (
    <>
      <Topbar
        title="Evolução do patrimônio"
        action={
          <div className="flex items-center gap-2">
            <a
              href={`/api/export/patrimonio.csv${viewing ? `?owner=${viewing.id}` : ""}`}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
              title="Baixar a planilha em CSV"
            >
              <Download size={16} /> CSV
            </a>
            <Button variant="secondary" onClick={() => openModal("invest")}>
              <PiggyBank size={16} /> Aportei
            </Button>
            <Button variant="secondary" onClick={() => openModal("settle")}>
              <Banknote size={16} /> Vendi / Recebi
            </Button>
            <Button variant="secondary" onClick={() => openModal("transfer")}>
              <ArrowLeftRight size={16} /> Transferir
            </Button>
            <Button onClick={() => openModal("record")}>
              <Plus size={16} /> Novo registro
            </Button>
          </div>
        }
      />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {latest && (
          <Card className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-slate-400">Patrimônio total</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {formatCurrency(latest.net_worth)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Investido</p>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                {formatCurrency(latest.invested)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Disponível para investir</p>
              <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">
                {formatCurrency(latest.cash_total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Registros</p>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                {result?.total ?? 0}
              </p>
            </div>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : !snapshots || snapshots.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhum registro ainda. Use "Novo registro" para anotar quanto vale cada posição hoje.
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#12141c]">
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-white/5">
                  <th className="sticky left-0 z-20 bg-white px-4 py-3 font-medium dark:bg-[#12141c]">
                    Data
                  </th>
                  {positions.map((position) => (
                    <th key={position.id} className="px-4 py-3 text-right font-medium">
                      {position.icon} {position.name}
                      {position.currency !== "BRL" && (
                        <span className="ml-1 text-[10px] text-slate-400">{position.currency}</span>
                      )}
                    </th>
                  ))}
                  {cashAccounts.map((account) => (
                    <th key={account.id} className="px-4 py-3 text-right font-medium">
                      💵 {account.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Entrada</th>
                  <th className="px-4 py-3 text-right font-medium">Investido</th>
                  <th className="px-4 py-3 text-right font-medium">Patrimônio</th>
                  <th className="px-4 py-3 font-medium">Obs</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="group">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-slate-800 group-hover:bg-slate-50 dark:bg-[#12141c] dark:text-slate-100 dark:group-hover:bg-white/[0.03]">
                      {formatDate(snapshot.date)}
                    </td>
                    {positions.map((position) => (
                      <td key={position.id} className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Money
                          value={snapshot.positions[String(position.id)] ?? 0}
                          native={snapshot.native?.[String(position.id)]}
                          currency={position.currency}
                          muted
                        />
                      </td>
                    ))}
                    {cashAccounts.map((account) => (
                      <td key={account.id} className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Money value={snapshot.cash[String(account.id)] ?? 0} muted />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Money value={snapshot.inflow} muted />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                      <Money value={snapshot.invested} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(snapshot.net_worth)}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-400" title={snapshot.notes ?? ""}>
                      {snapshot.notes}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDelete(snapshot)}
                        className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                        aria-label="Excluir registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {result && (
          <Pagination
            page={result.page}
            pages={result.pages}
            total={result.total}
            perPage={result.per_page}
            onChange={setPage}
            label="registros"
          />
        )}
      </main>

      <Modal
        open={modal === "record"}
        onClose={() => setModal(null)}
        title="Novo registro de patrimônio"
        error={error}
      >
        <SnapshotForm
          positions={positions}
          accounts={cashAccounts}
          onSubmit={handleSubmit}
          onCancel={() => setModal(null)}
          submitting={create.isPending}
        />
      </Modal>

      <Modal
        open={modal === "invest"}
        onClose={() => setModal(null)}
        title="Aportar numa posição"
        error={error}
      >
        <InvestForm
          positions={positions}
          accounts={cashAccounts}
          onSubmit={(data) => submit(invest.mutateAsync(data))}
          onCancel={() => setModal(null)}
          submitting={invest.isPending}
        />
      </Modal>

      <Modal
        open={modal === "settle"}
        onClose={() => setModal(null)}
        title="Vendi / recebi de volta"
        error={error}
      >
        <SettleForm
          positions={positions}
          accounts={cashAccounts}
          onSubmit={(data) => submit(settle.mutateAsync(data))}
          onCancel={() => setModal(null)}
          submitting={settle.isPending}
        />
      </Modal>

      <Modal
        open={modal === "transfer"}
        onClose={() => setModal(null)}
        title="Transferir entre posições"
        error={error}
      >
        <TransferForm
          positions={positions}
          accounts={cashAccounts}
          onSubmit={(data) => submit(transfer.mutateAsync(data))}
          onCancel={() => setModal(null)}
          submitting={transfer.isPending}
        />
      </Modal>
    </>
  )
}
