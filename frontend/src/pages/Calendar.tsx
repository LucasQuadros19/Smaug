import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, Check, Pencil, Plus, Trash2 } from "lucide-react"
import clsx from "clsx"
import { Topbar } from "../components/layout/Topbar"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Modal } from "../components/ui/Modal"
import { MonthSwitcher } from "../components/ui/MonthSwitcher"
import { EventForm } from "../components/calendar/EventForm"
import { useCalendar, useCalendarMutations } from "../hooks/useCalendar"
import { useSettings } from "../hooks/useMe"
import { useFormSubmit } from "../hooks/useFormSubmit"
import { currentMonth, formatCurrency, isoDate, todayISO } from "../lib/format"
import { holidayName } from "../lib/businessDays"
import type { CalendarEventInput } from "../api/calendar"
import type { CalendarEvent, CalendarItem, CalendarKind } from "../types"
import { useConfirm } from "../components/ui/ConfirmDialog"

const KINDS: Record<CalendarKind, { label: string; chip: string; dot: string }> = {
  bill: { label: "Contas", chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  income: { label: "Receitas", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  loan: { label: "Empréstimos", chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  expectation: { label: "Previsões", chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  goal: { label: "Metas", chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  event: { label: "Eventos", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
}
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const WEEKDAYS_MONDAY = [...WEEKDAYS.slice(1), WEEKDAYS[0]]
const STATUS_LABEL = { done: "feito", overdue: "atrasado", postponed: "adiado" }

/** Semanas do mês, de domingo a sábado (ou de segunda a domingo); os dias de fora vêm como null. */
function weeksOf(month: string, mondayFirst = false): (string | null)[][] {
  const [year, m] = month.split("-").map(Number)
  const first = new Date(year, m - 1, 1)
  const days = new Date(year, m, 0).getDate()
  const cells: (string | null)[] = [
    ...Array<null>(mondayFirst ? (first.getDay() + 6) % 7 : first.getDay()).fill(null),
    ...Array.from({ length: days }, (_, i) => isoDate(new Date(year, m - 1, i + 1))),
  ]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

function dayTitle(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function chipStyle(item: CalendarItem) {
  return item.kind === "event" && item.event ? { backgroundColor: `${item.event.color}1f`, color: item.event.color } : undefined
}

function dotStyle(item: CalendarItem) {
  return item.kind === "event" && item.event ? { backgroundColor: item.event.color } : undefined
}

function signed(item: CalendarItem) {
  if (item.amount == null) return null
  const sign = item.direction === "in" ? "+" : item.direction === "out" ? "−" : ""
  return `${sign}${formatCurrency(item.amount)}`
}

export function Calendar() {
  const [month, setMonth] = useState(currentMonth())
  const mondayFirst = useSettings().settings.week_starts_monday
  const [hidden, setHidden] = useState<Set<CalendarKind>>(new Set())
  const [picked, setPicked] = useState<string | null>(null)
  const [modal, setModal] = useState<{ event?: CalendarEvent; date: string } | null>(null)
  const { data, isLoading, isError } = useCalendar(month)
  const { create, update, remove } = useCalendarMutations()
  const ask = useConfirm()
  const { submit, error, reset } = useFormSubmit(() => setModal(null))

  const today = todayISO()
  const items = (data?.month === month ? data.items : []).filter((i) => !hidden.has(i.kind))
  const byDay = new Map<string, CalendarItem[]>()
  for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item])
  const selected = picked?.startsWith(month) ? picked : today.startsWith(month) ? today : `${month}-01`
  const dayItems = byDay.get(selected) ?? []

  const counts = new Map<CalendarKind, number>()
  for (const item of data?.items ?? []) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1)
  const sum = (direction: "in" | "out") =>
    items.filter((i) => i.direction === direction).reduce((s, i) => s + (i.amount ?? 0), 0)
  const entradas = sum("in")
  const saidas = sum("out")

  const openNew = (date: string) => {
    reset()
    setModal({ date })
  }
  const openEdit = (event: CalendarEvent) => {
    reset()
    setModal({ event, date: event.date })
  }
  const handleSubmit = (input: CalendarEventInput) =>
    submit(modal?.event ? update.mutateAsync({ id: modal.event.id, data: input }) : create.mutateAsync(input))
  const handleDelete = (event: CalendarEvent) =>
    ask({
      title: "Excluir evento?",
      message: `"${event.title}" sai do calendário.`,
      action: () => remove.mutateAsync(event.id),
      done: "Evento excluído",
    })
  const toggle = (kind: CalendarKind) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })

  return (
    <>
      <Topbar
        title="Calendário"
        action={
          <>
            <MonthSwitcher month={month} onChange={setMonth} />
            <Button onClick={() => openNew(selected)}>
              <Plus size={16} /> Novo evento
            </Button>
          </>
        }
      />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <Card className="grid gap-2 p-4 sm:grid-cols-3 sm:gap-4">
          {[
            { label: "Entradas no mês", value: entradas, className: "text-emerald-600 dark:text-emerald-400" },
            { label: "Saídas no mês", value: saidas, className: "text-rose-600 dark:text-rose-400" },
            { label: "Saldo do mês", value: entradas - saidas, className: "text-slate-900 dark:text-white" },
          ].map(({ label, value, className }) => (
            <div key={label} className="flex items-baseline justify-between gap-3 sm:block">
              <p className="text-xs text-slate-400">{label}</p>
              <p className={clsx("font-semibold sm:mt-1 sm:text-xl", className)}>{formatCurrency(value)}</p>
            </div>
          ))}
        </Card>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Mostrar no calendário">
          {(Object.keys(KINDS) as CalendarKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={!hidden.has(kind)}
              onClick={() => toggle(kind)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                hidden.has(kind)
                  ? "border-slate-200 text-slate-400 dark:border-white/10"
                  : "border-transparent bg-white text-slate-700 shadow-sm dark:bg-white/10 dark:text-slate-200"
              )}
            >
              <span className={clsx("h-2 w-2 rounded-full", KINDS[kind].dot, hidden.has(kind) && "opacity-40")} />
              {KINDS[kind].label}
              <span className="text-slate-400">{counts.get(kind) ?? 0}</span>
            </button>
          ))}
        </div>

        {isError && <p className="text-sm text-rose-500">Não deu para carregar o calendário.</p>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className={clsx("overflow-hidden p-0!", isLoading && "opacity-60")}>
            <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-medium text-slate-400 dark:border-white/5">
              {(mondayFirst ? WEEKDAYS_MONDAY : WEEKDAYS).map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {weeksOf(month, mondayFirst).flat().map((day, index) => {
                if (!day) return <div key={index} className="min-h-14 border-b border-r border-slate-100 bg-slate-50/50 [&:nth-child(7n)]:border-r-0 sm:min-h-24 dark:border-white/5 dark:bg-white/[0.01]" />
                const list = byDay.get(day) ?? []
                const overdue = list.some((i) => i.status === "overdue")
                const holiday = holidayName(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPicked(day)}
                    aria-label={`${dayTitle(day)}: ${list.length} ${list.length === 1 ? "item" : "itens"}`}
                    aria-pressed={day === selected}
                    className={clsx(
                      "flex min-h-14 min-w-0 flex-col gap-1 border-b border-r [&:nth-child(7n)]:border-r-0 border-slate-100 p-1 text-left transition-colors sm:min-h-24 sm:p-1.5 dark:border-white/5",
                      day === selected ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        day === today
                          ? "bg-indigo-600 font-semibold text-white"
                          : overdue
                            ? "font-semibold text-rose-600 dark:text-rose-400"
                            : "text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {holiday && (
                      <span className="truncate text-[10px] leading-none text-amber-600 dark:text-amber-400" title={holiday}>
                        <span className="sm:hidden">feriado</span>
                        <span className="hidden sm:inline">{holiday}</span>
                      </span>
                    )}
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 4).map((item) => (
                        <span key={item.key} className={clsx("h-1.5 w-1.5 rounded-full", KINDS[item.kind].dot)} style={dotStyle(item)} />
                      ))}
                    </span>
                    <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {list.slice(0, 3).map((item) => (
                        <span
                          key={item.key}
                          className={clsx(
                            "truncate rounded px-1.5 py-0.5 text-[11px] leading-tight",
                            KINDS[item.kind].chip,
                            item.status === "done" && "opacity-75",
                            item.status === "overdue" && "ring-1 ring-rose-400"
                          )}
                          style={chipStyle(item)}
                        >
                          {item.status === "done" && "✓ "}
                          {item.title}
                        </span>
                      ))}
                      {list.length > 3 && <span className="px-1 text-[11px] text-slate-400">+{list.length - 3} mais</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 self-start">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{dayTitle(selected)}</p>
                {holidayName(selected) && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Feriado: {holidayName(selected)}</p>
                )}
                <p className="text-xs text-slate-400">
                  {dayItems.length === 0 ? "Nada neste dia" : `${dayItems.length} ${dayItems.length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => openNew(selected)}>
                <Plus size={14} /> Evento
              </Button>
            </div>
            <ul className="space-y-2">
              {dayItems.map((item) => (
                <li key={item.key} className="flex items-start gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-white/5">
                  <span className={clsx("mt-1 h-8 w-1 shrink-0 rounded-full", KINDS[item.kind].dot)} style={dotStyle(item)} />
                  <div className="min-w-0 flex-1">
                    <p className={clsx("text-sm font-medium text-slate-800 dark:text-slate-100", item.status === "done" && "text-slate-500 dark:text-slate-400")}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      {KINDS[item.kind].label}
                      {item.status && (
                        <span
                          className={clsx(
                            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium",
                            item.status === "done" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            item.status === "overdue" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            item.status === "postponed" && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {item.status === "done" && <Check size={10} />}
                          {STATUS_LABEL[item.status]}
                        </span>
                      )}
                    </p>
                    {item.event?.notes && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.event.notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {signed(item) && (
                      <span
                        className={clsx(
                          "text-sm font-semibold whitespace-nowrap",
                          item.direction === "in" && "text-emerald-600 dark:text-emerald-400",
                          item.direction === "out" && "text-rose-600 dark:text-rose-400",
                          !item.direction && "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {signed(item)}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      {item.event ? (
                        <>
                          <button
                            onClick={() => openEdit(item.event!)}
                            aria-label="Editar evento"
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.event!)}
                            aria-label="Excluir evento"
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        item.link && (
                          <Link
                            to={item.link}
                            aria-label={`Abrir ${KINDS[item.kind].label}`}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                          >
                            <ArrowUpRight size={14} />
                          </Link>
                        )
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </main>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal?.event ? "Editar evento" : "Novo evento"} error={error}>
        {modal && (
          <EventForm
            key={modal.event?.id ?? modal.date}
            initial={modal.event}
            defaultDate={modal.date}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
            submitting={create.isPending || update.isPending}
          />
        )}
      </Modal>
    </>
  )
}
