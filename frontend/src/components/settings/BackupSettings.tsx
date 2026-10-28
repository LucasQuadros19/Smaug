import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CircleAlert, CircleCheck, Info, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { ApiError } from "../../api/client"
import { backupApi, type BackupConfig, type Destinatario, type Frequencia } from "../../api/backup"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { useConfirm } from "../ui/ConfirmDialog"
import { Input, Label, Select } from "../ui/Input"
import { Modal } from "../ui/Modal"
import { toast } from "../../lib/toast"

const KEY = ["backup"]
const MAX_EMAILS = 20
const EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>".]+$/

const FREQUENCIAS: { value: Frequencia; label: string }[] = [
  { value: "diario", label: "Todo dia" },
  { value: "semanal", label: "Toda sexta" },
  { value: "mensal", label: "Todo fim de mês" },
  { value: "desligado", label: "Não enviar" },
]
const ARQUIVOS = [
  { campo: "freq_planilha", nome: "Planilha", hint: "Patrimônio, transações e empréstimos de cada conta, em CSV." },
  { campo: "freq_banco", nome: "Cópia do banco", hint: "O sistema inteiro, para restaurar. Só vai para quem estiver marcado." },
] as const

const heading = "text-sm font-semibold text-slate-700 dark:text-slate-200"
const muted = "text-xs text-slate-400"

/** Backup por e-mail. Só aparece para quem criou a primeira conta (o resto recebe 403). */
export function BackupSettings() {
  const query = useQuery({
    queryKey: KEY,
    queryFn: () =>
      backupApi.get().catch((error) => {
        if (error instanceof ApiError && error.status === 403) return null
        throw error
      }),
    retry: false,
    // Enquanto o pedido de envio espera o servidor, a tela confere sozinha.
    refetchInterval: (q) => (q.state.data?.envio_pedido_em ? 10_000 : false),
  })

  if (query.isPending) return null
  if (query.error)
    return (
      <Card className="max-w-2xl">
        <h3 className={heading}>Backup por e-mail</h3>
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{query.error.message}</p>
      </Card>
    )
  if (!query.data) return null
  // Quando a configuração salva muda (salvou aqui ou em outro aparelho), o formulário recomeça dela.
  const { destinatarios, freq_banco, freq_planilha } = query.data
  return <BackupForm key={JSON.stringify([destinatarios, freq_banco, freq_planilha])} salvo={query.data} />
}

function BackupForm({ salvo }: { salvo: BackupConfig }) {
  const client = useQueryClient()
  const ask = useConfirm()
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>(salvo.destinatarios)
  const [freq, setFreq] = useState({ freq_banco: salvo.freq_banco, freq_planilha: salvo.freq_planilha })
  const [novoEmail, setNovoEmail] = useState("")
  const [erroEmail, setErroEmail] = useState("")
  const [senha, setSenha] = useState({ nova: "", repetir: "" })
  const [confirmando, setConfirmando] = useState(false)

  const alterado =
    JSON.stringify([destinatarios, freq.freq_banco, freq.freq_planilha]) !==
      JSON.stringify([salvo.destinatarios, salvo.freq_banco, salvo.freq_planilha]) || !!senha.nova

  const adicionar = () => {
    const email = novoEmail.trim().toLowerCase()
    if (!EMAIL.test(email)) return setErroEmail("Digite um e-mail válido.")
    if (destinatarios.some((d) => d.email === email)) return setErroEmail("Esse e-mail já está na lista.")
    if (destinatarios.length >= MAX_EMAILS) return setErroEmail(`No máximo ${MAX_EMAILS} e-mails.`)
    setDestinatarios([...destinatarios, { email, banco: false }])
    setNovoEmail("")
    setErroEmail("")
  }

  const erroSenha = !senha.nova && !senha.repetir
    ? ""
    : senha.nova.length < 12
      ? "A senha precisa ter pelo menos 12 caracteres."
      : senha.nova !== senha.repetir
        ? "As duas senhas não são iguais."
        : ""
  const ninguemComBanco = freq.freq_banco !== "desligado" && destinatarios.length > 0 && !destinatarios.some((d) => d.banco)

  const pedirSenha = () => {
    if (erroSenha) return toast(erroSenha, "error")
    if (novoEmail.trim()) return toast('Clique em "Adicionar" no e-mail digitado ou apague o campo antes de salvar.', "error")
    setConfirmando(true)
  }

  const enviarAgora = () =>
    ask({
      title: "Enviar o backup agora?",
      message: "O servidor grava uma planilha nova e manda os dois arquivos para a lista salva.",
      consequences: [
        `Vai para: ${salvo.destinatarios.map((d) => d.email).join(", ")}`,
        'A cópia do banco vai só para quem está marcado em "Recebe o banco". É a mais recente (o servidor faz uma a cada 6 horas).',
        "O envio automático das 16h continua igual.",
      ],
      confirmLabel: "Enviar agora",
      action: () => backupApi.enviar().then((data) => client.setQueryData(KEY, data)),
      done: "Pedido feito. O servidor manda em até 1 minuto.",
    })

  const ultimo = salvo.ultimo_envio
  const quando = (texto: string) => {
    const [dia, hora] = texto.split(" ")
    return `${dia.split("-").reverse().join("/")} às ${hora}`
  }

  return (
    <Card className="max-w-2xl space-y-5">
      <div>
        <h3 className={heading}>Backup por e-mail</h3>
        <p className={`mt-1 ${muted}`}>
          Uma cópia fora do servidor, num anexo com senha. Sai todo dia às 16h, conforme a frequência de cada arquivo.
        </p>
      </div>

      {!salvo.configurado && (
        <p className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
          <Info size={14} className="mt-0.5 shrink-0" />
          Ainda não foi salvo aqui. Até salvar, o servidor continua mandando para os e-mails e com a senha que estão no .env dele.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center dark:border-white/5">
        <div className="flex min-w-0 flex-1 items-start gap-2 text-sm">
          {salvo.envio_pedido_em ? (
            <>
              <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-indigo-500" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  Envio pedido às {salvo.envio_pedido_em.split(" ")[1]}: aguardando o servidor...
                </p>
                <p className={muted}>Leva até 1 minuto para começar. Esta tela atualiza sozinha.</p>
              </div>
            </>
          ) : ultimo ? (
            <>
              {ultimo.ok ? (
                <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              ) : (
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-rose-500" />
              )}
              <div className="min-w-0">
                <p className={ultimo.ok ? "font-medium text-emerald-700 dark:text-emerald-400" : "font-medium text-rose-700 dark:text-rose-400"}>
                  Último envio: {quando(ultimo.quando)} — {ultimo.ok ? "chegou" : "falhou"}
                </p>
                <p className={`break-words ${muted}`}>{ultimo.texto}</p>
              </div>
            </>
          ) : (
            <>
              <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">Nenhum envio registrado ainda.</p>
            </>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => (alterado ? toast("Salve as mudanças antes: o envio usa a configuração salva.", "error") : enviarAgora())}
          disabled={!!salvo.envio_pedido_em || !salvo.configurado || !salvo.destinatarios.length}
          title={!salvo.configurado ? "Salve a configuração antes de enviar" : undefined}
          className="shrink-0"
        >
          <Send size={14} /> Enviar agora
        </Button>
      </div>

      <div>
        <Label>Quem recebe</Label>
        <p className={`-mt-1 mb-2 ${muted}`}>A planilha vai para todos. A cópia do banco, só para quem você marcar.</p>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-white/5 dark:border-white/5">
          {destinatarios.length === 0 && (
            <li className="px-3 py-5 text-center text-sm text-slate-400">Ninguém na lista: o e-mail do backup fica desligado.</li>
          )}
          {destinatarios.map((d, i) => (
            <li key={d.email} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200" title={d.email}>
                {d.email}
              </span>
              <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={d.banco}
                  onChange={(e) => setDestinatarios(destinatarios.map((x, j) => (j === i ? { ...x, banco: e.target.checked } : x)))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-white/20 dark:bg-white/5"
                />
                Recebe o banco
              </label>
              <button
                onClick={() => setDestinatarios(destinatarios.filter((_, j) => j !== i))}
                aria-label={`Retirar ${d.email}`}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            type="email"
            aria-label="Novo e-mail"
            placeholder="email@exemplo.com"
            maxLength={120}
            value={novoEmail}
            onChange={(e) => {
              setNovoEmail(e.target.value)
              setErroEmail("")
            }}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
          />
          <Button variant="secondary" onClick={adicionar} className="shrink-0">
            <Plus size={14} /> Adicionar
          </Button>
        </div>
        {erroEmail && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{erroEmail}</p>}
        {ninguemComBanco && (
          <p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Ninguém marcado para receber o banco: a cópia do banco não vai sair por e-mail.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ARQUIVOS.map((a) => (
          <div key={a.campo}>
            <Label htmlFor={a.campo}>{a.nome}</Label>
            <Select id={a.campo} value={freq[a.campo]} onChange={(e) => setFreq({ ...freq, [a.campo]: e.target.value as Frequencia })}>
              {FREQUENCIAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <p className={`mt-1 ${muted}`}>{a.hint}</p>
          </div>
        ))}
      </div>

      <div>
        <Label>Senha do anexo</Label>
        <p className={`-mt-1 mb-2 ${muted}`}>
          {salvo.tem_senha
            ? "Definida aqui. Por segurança ela não aparece; para trocar, digite uma nova."
            : "Ainda não definida aqui: vale a senha que está no servidor."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="password"
            aria-label="Nova senha do anexo"
            autoComplete="new-password"
            maxLength={64}
            placeholder="Nova senha (mínimo 12)"
            value={senha.nova}
            onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
          />
          <Input
            type="password"
            aria-label="Repita a nova senha do anexo"
            autoComplete="new-password"
            maxLength={64}
            placeholder="Repita a nova senha"
            value={senha.repetir}
            onChange={(e) => setSenha({ ...senha, repetir: e.target.value })}
          />
        </div>
        {erroSenha && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{erroSenha}</p>}
        {senha.nova && !erroSenha && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Os e-mails que já saíram continuam abrindo só com a senha antiga. Anote as duas fora do sistema.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={pedirSenha} disabled={!alterado}>
          Salvar backup
        </Button>
      </div>

      {confirmando && (
        <ConfirmarComSenha
          onClose={() => setConfirmando(false)}
          salvar={(senha_login) =>
            backupApi
              .update({ senha_login, destinatarios, ...freq, senha_arquivos: senha.nova })
              .then((data) => {
                client.setQueryData(KEY, data)
                setSenha({ nova: "", repetir: "" })
                setConfirmando(false)
                toast("Backup salvo. Vale a partir do próximo envio.")
              })
          }
        />
      )}
    </Card>
  )
}

function ConfirmarComSenha({
  onClose,
  salvar,
}: {
  onClose: () => void
  salvar: (senha: string) => Promise<void>
}) {
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSalvando(true)
    setErro(null)
    salvar(senha)
      .catch((err: Error) => setErro(err.message))
      .finally(() => setSalvando(false))
  }

  return (
    <Modal open onClose={onClose} title="Confirmar com sua senha" error={erro}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Quem recebe o backup recebe os dados de todas as contas. Por isso essa mudança pede a sua senha de login.
        </p>
        <div>
          <Label htmlFor="backup-senha-login">Sua senha</Label>
          <Input
            id="backup-senha-login"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
