import { useState, type FormEvent, type ReactNode } from "react"
import clsx from "clsx"
import { Activity, Bot, CircleDollarSign, FlaskConical, Pencil, Plus, Power, ScrollText, Trash2, Wallet } from "lucide-react"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { useConfirm } from "../ui/ConfirmDialog"
import { Input, Label, Select } from "../ui/Input"
import { Modal } from "../ui/Modal"
import { ConfigFields } from "./ConfigFields"
import { useBotAccounts, useRobotLogs, useRobotMutations, useRobots, useRobotTrades } from "../../hooks/useBot"
import { DEFAULT_CONFIG, coin, sizingText, strategyText, timeframeName } from "../../lib/bot"
import { formatMoney } from "../../lib/format"
import { toast } from "../../lib/toast"
import type { BotAccounts, BotCatalog, BotConfig, BotPosition, BotRobot, BotRobotInput } from "../../types"

const usd = (value: number) => formatMoney(value, "USD")
const plain = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 8 })
const tone = (value: number) =>
  value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"

const STATUS: Record<BotRobot["status"], { label: string; dot: string; text: string }> = {
  ligado: { label: "Ligado", dot: "bg-emerald-500 animate-pulse", text: "text-emerald-600 dark:text-emerald-400" },
  desligado: { label: "Desligado", dot: "bg-slate-400", text: "text-slate-500 dark:text-slate-400" },
  erro: { label: "Parou com erro", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
}

const LEVEL: Record<string, string> = {
  CRITICAL: "text-rose-600 dark:text-rose-400",
  ERROR: "text-rose-600 dark:text-rose-400",
  WARNING: "text-amber-600 dark:text-amber-400",
  TRADING: "text-indigo-600 dark:text-indigo-400",
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Bot; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  )
}

function positionOf(accounts: BotAccounts | undefined, robot: BotRobot): BotPosition | undefined {
  return accounts?.subcontas
    .find((s) => s.subconta === robot.config.subconta)
    ?.posicoes.find((p) => p.cripto === robot.config.cripto)
}

function RobotForm({
  initial,
  editing,
  running,
  catalog,
  accounts,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: BotRobotInput
  editing: boolean
  running: boolean
  catalog: BotCatalog
  accounts: BotAccounts | undefined
  onSubmit: (data: BotRobotInput) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [data, setData] = useState(initial)
  const withKeys = new Set(accounts?.subcontas.map((s) => s.subconta))
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit(data)
      }}
      className="space-y-4"
    >
      {running && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Ele está ligado: ao salvar, reinicia com os parâmetros novos. Uma posição aberta continua com o stop e o alvo que já tem na Bybit.
        </p>
      )}
      <div className="grid grid-cols-[1fr_8rem] items-end gap-3">
        <div>
          <Label htmlFor="robo-nome">Nome</Label>
          <Input id="robo-nome" required maxLength={40} value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="robo-subconta">Subconta</Label>
          <Select
            id="robo-subconta"
            value={data.subconta}
            onChange={(e) => setData({ ...data, subconta: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
                {accounts && !withKeys.has(n) ? " (sem chave)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <ConfigFields value={data} onChange={(config) => setData({ ...data, ...config })} catalog={catalog} />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {editing ? "Salvar" : "Criar robô"}
        </Button>
      </div>
    </form>
  )
}

function Logs({ robot }: { robot: BotRobot }) {
  const logs = useRobotLogs(robot.id, true)
  if (logs.error) return <p className="text-xs text-rose-600 dark:text-rose-400">{logs.error.message}</p>
  if (!logs.data) return <p className="text-xs text-slate-400">Carregando...</p>
  if (logs.data.length === 0) return <p className="text-xs text-slate-400">Nenhum registro desde que a API do bot subiu.</p>
  return (
    <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1 text-xs">
      {logs.data.map((log, i) => (
        <li key={`${log.quando}-${i}`} className="grid grid-cols-[auto_1fr] gap-x-3">
          <time className="tabular-nums text-slate-400">
            {new Date(log.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </time>
          <div className="min-w-0">
            <p className={clsx("break-words", LEVEL[log.nivel] ?? "text-slate-700 dark:text-slate-200")}>{log.mensagem}</p>
            {log.detalhes && <p className="break-words font-mono text-[10px] text-slate-400">{log.detalhes}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Trades({ robot }: { robot: BotRobot }) {
  const trades = useRobotTrades(robot.id, true)
  if (trades.error) return <p className="text-xs text-rose-600 dark:text-rose-400">{trades.error.message}</p>
  if (!trades.data) return <p className="text-xs text-slate-400">Buscando na Bybit...</p>
  if (trades.data.length === 0) return <p className="text-xs text-slate-400">Nenhuma operação fechada de {robot.config.cripto} nessa subconta.</p>
  const total = trades.data.reduce((sum, t) => sum + t.resultado, 0)
  return (
    <div className="space-y-2 text-xs">
      <p className="text-slate-500 dark:text-slate-400">
        {trades.data.length} últimas operações de {robot.config.cripto} na subconta {robot.config.subconta} (incluindo as feitas à mão):{" "}
        <span className={clsx("font-medium", tone(total))}>{usd(total)}</span>
      </p>
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[420px]">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-2 font-medium">Fechou</th>
              <th className="py-1 pr-2 font-medium">Lado</th>
              <th className="py-1 pr-2 text-right font-medium">Quantidade</th>
              <th className="py-1 pr-2 text-right font-medium">Preço</th>
              <th className="py-1 text-right font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {trades.data.map((t, i) => (
              <tr key={`${t.quando}-${i}`} className="text-slate-600 dark:text-slate-300">
                <td className="py-1 pr-2">{new Date(t.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="py-1 pr-2">{t.lado === "compra" ? "Compra" : "Venda"}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{plain(t.quantidade)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {plain(t.entrada)} → {plain(t.saida)}
                </td>
                <td className={clsx("py-1 text-right tabular-nums", tone(t.resultado))}>{usd(t.resultado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RobotCard({
  robot,
  catalog,
  position,
  testnet,
  onEdit,
}: {
  robot: BotRobot
  catalog: BotCatalog
  position: BotPosition | undefined
  testnet: boolean | undefined
  onEdit: () => void
}) {
  const ask = useConfirm()
  const { start, stop, remove } = useRobotMutations()
  const [panel, setPanel] = useState<"logs" | "trades" | null>(null)
  const { config } = robot
  const status = STATUS[robot.status]
  const where = `${config.cripto} na subconta ${config.subconta}`

  const turnOn = () =>
    ask({
      title: robot.status === "erro" ? "Ligar de novo" : "Ligar robô",
      message: (
        <>
          <strong>{config.nome}</strong> vai operar {where}
          {testnet ? " na testnet." : " com dinheiro de verdade."}
        </>
      ),
      consequences: [
        `Entra sozinho quando aparecer o sinal: ${strategyText(config, catalog)}, gráfico de ${timeframeName(config.tempo_grafico, catalog)}.`,
        `Tamanho de cada operação: ${sizingText(config)}.`,
        "Desligar depois não fecha a posição: o stop e o alvo continuam valendo na Bybit.",
      ],
      confirmLabel: "Ligar",
      action: () => start.mutateAsync(robot.id),
      done: "Robô ligado",
    })

  const turnOff = () =>
    ask({
      title: "Desligar robô",
      message: (
        <>
          <strong>{config.nome}</strong> para de procurar entradas em {where}.
        </>
      ),
      consequences: position
        ? ["A posição aberta continua na Bybit, com o stop e o alvo dela. Para fechar antes, feche na Bybit."]
        : undefined,
      confirmLabel: "Desligar",
      action: () => stop.mutateAsync(robot.id),
      done: "Robô desligado",
    })

  const destroy = () =>
    ask({
      title: "Excluir robô",
      message: (
        <>
          Excluir <strong>{config.nome}</strong>? Some só a configuração: nada muda na Bybit.
        </>
      ),
      tone: "danger",
      confirmLabel: "Excluir",
      action: () => remove.mutateAsync(robot.id),
      done: "Robô excluído",
    })

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-100">{config.nome}</span>
            <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium", status.text)}>
              <span className={clsx("h-2 w-2 rounded-full", status.dot)} />
              {status.label}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {coin(config.cripto)} · {timeframeName(config.tempo_grafico, catalog)} · subconta {config.subconta} · {strategyText(config, catalog)}
          </p>
          <p className="text-[11px] text-slate-400">{sizingText(config)}</p>
        </div>
        <div className="flex items-center gap-1">
          {robot.status !== "ligado" && (
            <Button className="px-3 py-1.5 text-xs" onClick={turnOn}>
              <Power size={14} /> {robot.status === "erro" ? "Ligar de novo" : "Ligar"}
            </Button>
          )}
          {robot.ativo && (
            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={turnOff}>
              <Power size={14} /> Desligar
            </Button>
          )}
          <button
            onClick={() => setPanel(panel === "logs" ? null : "logs")}
            aria-label="Registros"
            aria-pressed={panel === "logs"}
            className={clsx(
              "rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200",
              panel === "logs" && "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-100"
            )}
          >
            <ScrollText size={16} />
          </button>
          <button
            onClick={onEdit}
            aria-label="Editar"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={destroy}
            disabled={robot.ativo}
            aria-label="Excluir"
            title={robot.ativo ? "Desligue antes de excluir" : undefined}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {robot.status === "erro" && robot.erro && (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{robot.erro}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-white/[0.03]">
        {position ? (
          <span className="text-slate-600 dark:text-slate-300">
            <span className={clsx("font-semibold", position.lado === "compra" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {position.lado === "compra" ? "Comprado" : "Vendido"}
            </span>{" "}
            {plain(position.tamanho)} a {plain(position.entrada)}
            {position.stop ? ` · stop ${plain(position.stop)}` : ""}
            {position.alvo ? ` · alvo ${plain(position.alvo)}` : ""}
            {position.resultado_aberto != null && (
              <span className={clsx("ml-2 font-medium", tone(position.resultado_aberto))}>{usd(position.resultado_aberto)}</span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">Sem posição aberta em {config.cripto}</span>
        )}
        <button
          onClick={() => setPanel(panel === "trades" ? null : "trades")}
          className="text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {panel === "trades" ? "Esconder operações" : "Operações fechadas"}
        </button>
      </div>

      {panel === "logs" && <Logs robot={robot} />}
      {panel === "trades" && <Trades robot={robot} />}
    </li>
  )
}

export function Robots({
  catalog,
  draft,
}: {
  catalog: BotCatalog
  /** Configuração vinda de uma simulação ("Usar num robô"): abre o formulário com ela. */
  draft: BotConfig | null
}) {
  const robots = useRobots()
  const accounts = useBotAccounts()
  const { create, update } = useRobotMutations()
  const [form, setForm] = useState<{ robot: BotRobot | null; initial: BotRobotInput } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const newRobot = (config: BotConfig) => {
    const firstWithKey = accounts.data?.subcontas[0]?.subconta ?? 1
    const { estrategia, cripto, tempo_grafico, compra, venda, alavancagem, risco_pct } = config
    setError(null)
    setForm({
      robot: null,
      initial: {
        estrategia, cripto, tempo_grafico, compra, venda, alavancagem, risco_pct,
        nome: `${coin(cripto)} ${timeframeName(tempo_grafico, catalog)}`,
        subconta: firstWithKey,
      },
    })
  }

  const [seenDraft, setSeenDraft] = useState<BotConfig | null>(null)
  if (draft && draft !== seenDraft) {
    setSeenDraft(draft)
    newRobot(draft)
  }

  const save = (data: BotRobotInput) => {
    setError(null)
    const action = form?.robot ? update.mutateAsync({ id: form.robot.id, data }) : create.mutateAsync(data)
    action
      .then(() => {
        toast(form?.robot ? "Robô salvo" : "Robô criado: ligue quando quiser")
        setForm(null)
      })
      .catch((err: Error) => setError(err.message))
  }

  const list = robots.data ?? []
  const on = list.filter((r) => r.status === "ligado").length
  const failed = list.filter((r) => r.status === "erro").length
  const subcontas = accounts.data?.subcontas ?? []
  const answered = subcontas.filter((s) => s.patrimonio != null)
  const equity = subcontas.reduce((sum, s) => sum + (s.patrimonio ?? 0), 0)
  const available = subcontas.reduce((sum, s) => sum + (s.disponivel ?? 0), 0)
  const positions = subcontas.flatMap((s) => s.posicoes)
  const openResult = positions.reduce((sum, p) => sum + (p.resultado_aberto ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Activity} label="Robôs ligados" value={`${on} de ${list.length}`} sub={failed ? `${failed} parou com erro` : undefined} />
        <Kpi
          icon={Wallet}
          label="Saldo nas subcontas"
          value={answered.length ? usd(equity) : "—"}
          sub={answered.length ? `disponível ${usd(available)}` : accounts.data && !subcontas.length ? "nenhuma chave no .env do bot" : undefined}
        />
        <Kpi
          icon={CircleDollarSign}
          label="Posições abertas"
          value={positions.length}
          sub={positions.length ? <span className={tone(openResult)}>{usd(openResult)} em aberto</span> : undefined}
        />
        <Kpi
          icon={FlaskConical}
          label="Conta"
          value={accounts.data ? (accounts.data.testnet ? "Testnet" : "Real") : "—"}
          sub={accounts.data ? (accounts.data.testnet ? "dinheiro de teste" : "dinheiro de verdade") : undefined}
        />
      </div>

      {accounts.error && (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{accounts.error.message}</p>
      )}
      {subcontas
        .filter((s) => s.erro)
        .map((s) => (
          <p key={s.subconta} className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Subconta {s.subconta}: a Bybit recusou a chave ({s.erro})
          </p>
        ))}

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Robôs</h3>
          <Button className="px-3 py-1.5 text-xs" onClick={() => newRobot(DEFAULT_CONFIG)}>
            <Plus size={14} /> Novo robô
          </Button>
        </div>
        {robots.error ? (
          <p className="px-5 py-4 text-sm text-rose-600 dark:text-rose-400">{robots.error.message}</p>
        ) : !robots.data ? (
          <p className="px-5 py-4 text-sm text-slate-400">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
            Nenhum robô ainda. Crie um aqui, ou teste parâmetros em Simulações e use “Usar num robô”.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/5">
            {list.map((robot) => (
              <RobotCard
                key={robot.id}
                robot={robot}
                catalog={catalog}
                position={positionOf(accounts.data, robot)}
                testnet={accounts.data?.testnet}
                onEdit={() => {
                  setError(null)
                  setForm({ robot, initial: robot.config })
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.robot ? "Editar robô" : "Novo robô"} error={error}>
        {form && (
          <RobotForm
            key={form.robot?.id ?? "novo"}
            initial={form.initial}
            editing={form.robot !== null}
            running={form.robot?.status === "ligado"}
            catalog={catalog}
            accounts={accounts.data}
            onSubmit={save}
            onCancel={() => setForm(null)}
            submitting={create.isPending || update.isPending}
          />
        )}
      </Modal>
    </div>
  )
}
