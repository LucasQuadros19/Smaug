import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "./Button"
import { Input } from "./Input"
import { Modal } from "./Modal"
import { toast } from "../../lib/toast"

export type ConfirmRequest = {
  title: string
  /** Uma frase sobre o que vai ser feito. */
  message: ReactNode
  /** O que acontece junto (o que some, o que continua). */
  consequences?: string[]
  confirmLabel?: string
  /** "danger": botão vermelho, para excluir e desfazer. */
  tone?: "danger" | "default"
  /** Jeitos de fazer (a primeira é a escolhida de início). A ação recebe o `value` da escolhida. */
  choices?: ConfirmChoice[]
  /** A ação de verdade. Se falhar, o motivo aparece na própria janela, que continua aberta. */
  action: (choice?: string) => Promise<unknown>
  /** Aviso no canto quando der certo (pode depender da escolha). */
  done?: string | ((choice?: string) => string)
}

export type ConfirmChoice = {
  value: string
  label: string
  hint?: string
  /** Para escolhas perigosas: só libera o botão depois de digitar este texto. */
  typeToConfirm?: string
}

const ConfirmContext = createContext<(request: ConfirmRequest) => void>(() => {})

/** Pede confirmação antes de excluir/desfazer: `confirm({ title, message, action })`. */
export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<string | undefined>()
  const [typed, setTyped] = useState("")

  const open = useCallback((next: ConfirmRequest) => {
    setError(null)
    setPending(false)
    setChoice(next.choices?.[0]?.value)
    setTyped("")
    setRequest(next)
  }, [])
  const close = useCallback(() => {
    if (!pending) setRequest(null)
  }, [pending])

  const run = async () => {
    if (!request) return
    setPending(true)
    setError(null)
    try {
      await request.action(choice)
      setRequest(null)
      if (request.done) toast(typeof request.done === "function" ? request.done(choice) : request.done)
    } catch (err) {
      setError((err as Error).message || "Não deu certo. Tente de novo.")
    } finally {
      setPending(false)
    }
  }

  const danger = (request?.tone ?? "danger") === "danger"
  const selected = request?.choices?.find((c) => c.value === choice)
  const needsTyping = selected?.typeToConfirm
  const typedOk = !needsTyping || typed.trim().toLowerCase() === needsTyping.trim().toLowerCase()

  return (
    <ConfirmContext.Provider value={open}>
      {children}
      <Modal open={request !== null} onClose={close} title={request?.title ?? ""}>
        {request && (
          <div className="space-y-4">
            <div className="flex gap-3">
              {danger && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={18} />
                </span>
              )}
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div>{request.message}</div>
                {request.consequences && request.consequences.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-500 dark:text-slate-400">
                    {request.consequences.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {request.choices && (
              <div role="radiogroup" className="space-y-2">
                {request.choices.map((c) => (
                  <label
                    key={c.value}
                    className={
                      "flex cursor-pointer gap-3 rounded-xl border p-3 " +
                      (c.value === choice
                        ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500"
                        : "border-slate-200 dark:border-white/10")
                    }
                  >
                    <input
                      type="radio"
                      name="confirm-choice"
                      checked={c.value === choice}
                      onChange={() => {
                        setChoice(c.value)
                        setTyped("")
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                      {c.hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{c.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {needsTyping && !error && (
              <div>
                <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Para confirmar, digite <strong className="text-slate-800 dark:text-slate-100">{needsTyping}</strong>:
                </p>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label="Confirmação" />
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                <p className="font-medium">Não foi possível concluir</p>
                <p>{error}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close} disabled={pending} autoFocus>
                {error ? "Fechar" : "Cancelar"}
              </Button>
              {!error && (
                <Button type="button" variant={danger ? "danger" : "primary"} onClick={run} disabled={pending || !typedOk}>
                  {pending ? "Aguarde..." : (request.confirmLabel ?? "Excluir")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}
