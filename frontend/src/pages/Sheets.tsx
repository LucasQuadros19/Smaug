import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import clsx from "clsx"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { useCalcRefs, useSheetMutations, useSheets, type CalcRef } from "../hooks/useSheets"
import { evaluateSheet, slug } from "../lib/calc"
import type { Sheet } from "../types"

const OPEN_KEY = "smaug.folhas-abertas"
const LINE = 24 // px — textarea e coluna de resultados precisam da mesma altura de linha

const bigNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
const smallNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 })
// Abaixo de 100 (cotação, preço unitário) mostra até 4 casas: @dolar é 4,9988, não 5.
const formatNumber = (value: number) => (Math.abs(value) < 100 ? smallNumber : bigNumber).format(value)

const EXAMPLE = `capital = 10.000
juros: capital * 10%
@emprestimo.pedro.lucas
soma`

function readOpen(): number[] | null {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    return raw ? (JSON.parse(raw) as number[]) : null
  } catch {
    return null
  }
}

function saveOpen(ids: number[]) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(ids))
  } catch {
    // sem armazenamento (aba anônima): só não lembra quais estavam abertas
  }
}

/** O "@..." que está sendo digitado antes do cursor, já normalizado. */
function refBeforeCaret(text: string, caret: number) {
  const before = text.slice(0, caret)
  const match = before.match(/@[\p{L}\p{N}_.]*$/u)
  if (!match) return null
  return {
    start: caret - match[0].length,
    query: match[0].slice(1).split(".").map(slug).join("."),
    line: before.split("\n").length - 1,
  }
}

function suggestionsFor(refs: CalcRef[], query: string) {
  const starts = refs.filter((r) => r.key.startsWith(query))
  const list = starts.length > 0 ? starts : refs.filter((r) => r.key.includes(query))
  // Primeiro o nível que está sendo digitado (emprestimo.pedro antes de emprestimo.pedro.lucas).
  return list.sort((a, b) => a.key.split(".").length - b.key.split(".").length).slice(0, 8)
}

function SheetColumn({
  sheet,
  refs,
  onClose,
}: {
  sheet: Sheet
  refs: CalcRef[]
  onClose: () => void
}) {
  const { update, remove } = useSheetMutations()
  const [content, setContent] = useState(sheet.content)
  const [title, setTitle] = useState(sheet.title)
  const [suggest, setSuggest] = useState<ReturnType<typeof refBeforeCaret>>(null)
  const [active, setActive] = useState(0)
  const textarea = useRef<HTMLTextAreaElement>(null)

  const refValues = useMemo(() => Object.fromEntries(refs.map((r) => [r.key, r.value])), [refs])
  const results = useMemo(() => evaluateSheet(content, refValues), [content, refValues])
  const options = suggest ? suggestionsFor(refs, suggest.query) : []

  // Salva sozinho, um pouco depois de parar de digitar.
  useEffect(() => {
    if (content === sheet.content) return
    const timer = setTimeout(() => update.mutate({ id: sheet.id, data: { content } }), 600)
    return () => clearTimeout(timer)
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshSuggest = () => {
    const el = textarea.current
    if (!el) return
    setSuggest(refBeforeCaret(el.value, el.selectionStart))
    setActive(0)
  }

  const accept = (ref: CalcRef) => {
    const el = textarea.current
    if (!el || !suggest) return
    const caret = el.selectionStart
    const next = `${content.slice(0, suggest.start)}@${ref.key}${content.slice(caret)}`
    const position = suggest.start + ref.key.length + 1
    setContent(next)
    setSuggest(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(position, position)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggest || options.length === 0) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const step = e.key === "ArrowDown" ? 1 : -1
      setActive((i) => (i + step + options.length) % options.length)
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      accept(options[active])
    } else if (e.key === "Escape") {
      setSuggest(null)
    }
  }

  const lines = content.split("\n").length

  return (
    <Card className="flex w-full shrink-0 flex-col gap-3 p-0 sm:w-[380px]">
      <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2.5 dark:border-white/5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== sheet.title && update.mutate({ id: sheet.id, data: { title } })}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none dark:text-slate-100"
          aria-label="Título da folha"
        />
        <button
          onClick={() => confirm(`Apagar a folha "${sheet.title}"?`) && remove.mutate(sheet.id)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          aria-label="Apagar folha"
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          aria-label="Fechar folha"
          title="Fechar (continua salva)"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative flex px-4 pb-4 font-mono text-sm" style={{ lineHeight: `${LINE}px` }}>
        <textarea
          ref={textarea}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setSuggest(refBeforeCaret(e.target.value, e.target.selectionStart))
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          onClick={refreshSuggest}
          onBlur={() => setTimeout(() => setSuggest(null), 150)}
          rows={Math.max(lines, 8)}
          wrap="off"
          spellCheck={false}
          placeholder={EXAMPLE}
          className="min-w-0 flex-1 resize-none overflow-x-auto overflow-y-hidden bg-transparent text-slate-800 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
          style={{ lineHeight: `${LINE}px` }}
        />
        {/* Uma linha de resultado para cada linha do texto. */}
        <div className="w-28 shrink-0 border-l border-slate-100 pl-3 text-right dark:border-white/5" aria-hidden>
          {results.map((result, i) => (
            <div
              key={i}
              style={{ height: LINE }}
              className={clsx(
                "truncate",
                result.kind === "error" ? "text-rose-400" : "text-indigo-600 dark:text-indigo-300"
              )}
              title={result.kind === "error" ? result.message : undefined}
            >
              {result.kind === "value" ? formatNumber(result.value) : result.kind === "error" ? "⚠" : ""}
            </div>
          ))}
        </div>

        {suggest && options.length > 0 && (
          <ul
            className="absolute left-4 right-4 z-20 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 font-sans shadow-lg dark:border-white/10 dark:bg-[#12141e]"
            style={{ top: (suggest.line + 1) * LINE + 4 }}
          >
            {options.map((ref, i) => (
              <li key={ref.key}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault() // não tira o foco do texto
                    accept(ref)
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs",
                    i === active ? "bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-slate-800 dark:text-slate-100">@{ref.key}</span>
                    <span className="block truncate text-slate-400">{ref.hint}</span>
                  </span>
                  <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">
                    {formatNumber(ref.value)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function Sheets() {
  const { data: sheets, isLoading } = useSheets()
  const { create } = useSheetMutations()
  const refs = useCalcRefs()
  const [openIds, setOpenIds] = useState<number[] | null>(readOpen)

  // Sem preferência salva, todas ficam abertas.
  const open = openIds ?? sheets?.map((s) => s.id) ?? []
  const setOpen = (ids: number[]) => {
    setOpenIds(ids)
    saveOpen(ids)
  }
  const toggle = (id: number) => setOpen(open.includes(id) ? open.filter((i) => i !== id) : [...open, id])

  const newSheet = () =>
    create.mutate(`Folha ${(sheets?.length ?? 0) + 1}`, { onSuccess: (sheet) => setOpen([...open, sheet.id]) })

  const visible = (sheets ?? []).filter((s) => open.includes(s.id))

  return (
    <>
      <Topbar
        title="Cálculos"
        action={
          <Button onClick={newSheet} disabled={create.isPending}>
            <Plus size={16} /> Nova folha
          </Button>
        }
      />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : !sheets || sheets.length === 0 ? (
          <Card className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">Folhas de cálculo</p>
            <p>Uma conta por linha, resultado na lateral. Tudo fica salvo sozinho.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li><code>capital = 10.000</code> cria um valor para usar depois</li>
              <li><code>juros: capital * 10%</code> — antes do ":" é só o nome da linha</li>
              <li><code>@</code> puxa valores do sistema: <code>@emprestimo.pedro</code>, <code>@emprestimo.pedro.lucas</code>, <code>@dolar</code>, <code>@patrimonio</code></li>
              <li><code>soma</code> soma tudo acima até a soma anterior</li>
            </ul>
          </Card>
        ) : (
          <>
            {/* Quais folhas ficam lado a lado — para comparar. */}
            <div className="flex flex-wrap gap-2">
              {sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => toggle(sheet.id)}
                  className={clsx(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    open.includes(sheet.id)
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400"
                  )}
                >
                  {sheet.title}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="text-sm text-slate-400">Escolha acima as folhas para abrir lado a lado.</p>
            ) : (
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:overflow-x-auto sm:pb-2">
                {visible.map((sheet) => (
                  <SheetColumn key={sheet.id} sheet={sheet} refs={refs} onClose={() => toggle(sheet.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
