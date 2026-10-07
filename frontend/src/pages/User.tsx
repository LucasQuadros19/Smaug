import { useState, type FormEvent } from "react"
import { Copy } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Input, Label } from "../components/ui/Input"
import { Toggle } from "../components/ui/Toggle"
import { useAuthActions, useMe } from "../hooks/useMe"
import { useShareMutations, useShares } from "../hooks/useShares"
import { firstTab, SHARE_SECTIONS } from "../lib/navigation"
import { switchViewing } from "../lib/viewing"
import type { Share, ShareSection } from "../types"

const heading = "text-sm font-semibold text-slate-700 dark:text-slate-200"
const hint = "text-xs text-slate-400"
const box = "rounded-xl border px-3 py-2 text-sm"
const errorBox = `${box} border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400`
const okBox = `${box} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400`
const STATUS_ORDER = { incoming: 0, active: 1, outgoing: 2 }

function names(sections: ShareSection[]) {
  if (!sections.length) return "nada"
  return SHARE_SECTIONS.filter((s) => sections.includes(s.key))
    .map((s) => s.label)
    .join(", ")
}

function SectionPicker({ value, onChange }: { value: ShareSection[]; onChange: (next: ShareSection[]) => void }) {
  const all = SHARE_SECTIONS.map((s) => s.key)
  const toggle = (key: ShareSection, on: boolean) => onChange(all.filter((k) => (k === key ? on : value.includes(k))))
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Toggle
        label="Tudo"
        hint="Todas as partes, inclusive o Dashboard"
        checked={value.length === all.length}
        onChange={(on) => onChange(on ? all : [])}
      />
      {SHARE_SECTIONS.map(({ key, label, hint }) => (
        <Toggle key={key} label={label} hint={hint} checked={value.includes(key)} onChange={(on) => toggle(key, on)} />
      ))}
    </div>
  )
}

function AccountCard({ id, username }: { id: string; username: string }) {
  const [copied, setCopied] = useState(false)
  // Sem HTTPS (endereço da rede local) o navegador não libera a área de transferência.
  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard
  const copy = () => navigator.clipboard.writeText(id).then(() => setCopied(true))

  return (
    <Card>
      <h3 className={heading}>Sua conta</h3>
      <div className="mt-4 space-y-4 text-sm">
        <div>
          <p className={hint}>Usuário</p>
          <p className="font-medium text-slate-900 dark:text-white">{username}</p>
        </div>
        <div>
          <Label htmlFor="codigo">Seu código</Label>
          <div className="flex gap-2">
            <Input id="codigo" readOnly value={id} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            {canCopy && (
              <Button type="button" variant="secondary" onClick={copy}>
                <Copy size={14} /> {copied ? "Copiado" : "Copiar"}
              </Button>
            )}
          </div>
          <p className={`mt-1 ${hint}`}>Passe este código para quem vai compartilhar dados com você.</p>
        </div>
      </div>
    </Card>
  )
}

function PasswordCard() {
  const { changePassword } = useAuthActions()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (next !== repeat) {
      setMessage({ ok: false, text: "A repetição não bate com a nova senha" })
      return
    }
    setMessage(null)
    setBusy(true)
    changePassword(current, next)
      .then(() => {
        setCurrent("")
        setNext("")
        setRepeat("")
        setMessage({ ok: true, text: "Senha trocada. Os outros aparelhos foram desconectados." })
      })
      .catch((err: Error) => setMessage({ ok: false, text: err.message }))
      .finally(() => setBusy(false))
  }

  return (
    <Card>
      <h3 className={heading}>Trocar senha</h3>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="senha-atual">Senha atual</Label>
          <Input
            id="senha-atual"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="senha-nova">Nova senha</Label>
          <Input
            id="senha-nova"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="senha-repetida">Repita a nova senha</Label>
          <Input
            id="senha-repetida"
            type="password"
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        {message && <div className={message.ok ? okBox : errorBox}>{message.text}</div>}
        <Button type="submit" disabled={busy}>
          Trocar senha
        </Button>
      </form>
    </Card>
  )
}

function ShareItem({ share }: { share: Share }) {
  const { accept, update, end } = useShareMutations()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [sections, setSections] = useState(share.i_share)
  const name = share.user.username
  const error = accept.error ?? update.error ?? end.error

  const view = () => {
    switchViewing(client, { id: share.user.id, username: name, sections: share.they_share })
    navigate(firstTab(share.they_share))
  }
  const finish = (question: string) => {
    if (confirm(question)) end.mutate(share.id)
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-100 p-4 dark:border-white/5">
      {share.status === "incoming" && (
        <>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong>{name}</strong> quer compartilhar com você e mostra: {names(share.they_share)}.
          </p>
          <p className={hint}>O que você mostra para {name} (pode ser nada):</p>
          <SectionPicker value={sections} onChange={setSections} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => accept.mutate({ id: share.id, sections })} disabled={accept.isPending}>
              Aceitar
            </Button>
            <Button variant="ghost" onClick={() => finish(`Recusar o convite de ${name}?`)}>
              Recusar
            </Button>
          </div>
        </>
      )}

      {share.status === "outgoing" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">
            Esperando <strong>{name}</strong> aceitar. Você mostra: {names(share.i_share)}.
          </p>
          <Button variant="ghost" onClick={() => finish(`Cancelar o convite para ${name}?`)}>
            Cancelar convite
          </Button>
        </div>
      )}

      {share.status === "active" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">
              <strong>{name}</strong> mostra para você: {names(share.they_share)}.
            </p>
            {share.they_share.length > 0 && (
              <Button variant="secondary" onClick={view}>
                Ver dados de {name}
              </Button>
            )}
          </div>
          <p className={hint}>O que você mostra para {name}:</p>
          <SectionPicker value={sections} onChange={setSections} />
          <div className="flex flex-wrap gap-2">
            {sections.join() !== share.i_share.join() && (
              <Button onClick={() => update.mutate({ id: share.id, sections })} disabled={update.isPending}>
                Salvar
              </Button>
            )}
            <Button variant="ghost" onClick={() => finish(`Encerrar o compartilhamento com ${name}?`)}>
              Encerrar
            </Button>
          </div>
        </>
      )}

      {error && <div className={errorBox}>{error.message}</div>}
    </div>
  )
}

function InviteForm() {
  const { invite } = useShareMutations()
  const [code, setCode] = useState("")
  const [sections, setSections] = useState<ShareSection[]>([])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    invite.mutate(
      { user_id: code.trim(), sections },
      {
        onSuccess: () => {
          setCode("")
          setSections([])
        },
      }
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h4 className={heading}>Convidar alguém</h4>
      <div>
        <Label htmlFor="codigo-convite">Código da outra pessoa</Label>
        <Input
          id="codigo-convite"
          required
          autoComplete="off"
          className="font-mono text-xs"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <p className={hint}>O que você mostra para ela (pode ser nada, se só quiser ver o que ela mostrar):</p>
      <SectionPicker value={sections} onChange={setSections} />
      {invite.error && <div className={errorBox}>{invite.error.message}</div>}
      <Button type="submit" disabled={invite.isPending}>
        Enviar convite
      </Button>
    </form>
  )
}

export function UserPage() {
  const { data: user } = useMe()
  const { data: shares } = useShares()
  if (!user) return null
  const sorted = [...(shares ?? [])].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  return (
    <>
      <Topbar title="Usuário" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
          <AccountCard id={user.id} username={user.username} />
          <PasswordCard />
          <Card className="lg:col-span-2">
            <h3 className={heading}>Compartilhamento</h3>
            <p className={`mt-1 ${hint}`}>
              Mostre partes dos seus dados para outra pessoa. Ela precisa aceitar e escolhe o que mostra de volta: as
              duas partes, só uma ou nenhuma, iguais ou diferentes. Quem recebe pode ver e editar o que foi mostrado, e
              qualquer um dos dois pode mudar ou encerrar quando quiser.
            </p>
            {sorted.length > 0 && (
              <div className="mt-5 space-y-3">
                {sorted.map((share) => (
                  <ShareItem key={share.id} share={share} />
                ))}
              </div>
            )}
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/5">
              <InviteForm />
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
