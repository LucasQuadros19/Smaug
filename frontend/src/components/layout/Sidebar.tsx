import { CircleUser, Flame, LogOut, Settings, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { NavLink, useNavigate } from "react-router-dom"
import clsx from "clsx"
import { Select } from "../ui/Input"
import { useAuthActions, useMe } from "../../hooks/useMe"
import { useSharedWithMe } from "../../hooks/useShares"
import { canSee, firstTab, navSections } from "../../lib/navigation"
import { switchViewing, useViewing } from "../../lib/viewing"

// Vem do package.json (vite.config.ts).
declare const __APP_VERSION__: string

const itemClass = "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
const idleClass =
  "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    itemClass,
    isActive ? "bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" : idleClass
  )

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user } = useMe()
  const { logout } = useAuthActions()
  const client = useQueryClient()
  const navigate = useNavigate()
  const viewing = useViewing()
  const sources = useSharedWithMe()
  const hidden = new Set(user?.hidden_tabs ?? [])
  // Nos dados de outra pessoa valem as partes que ela mostrou; nos seus, as abas que você não escondeu.
  const visible = (link: (typeof navSections)[number]["links"][number]) =>
    viewing ? canSee(link.section, viewing.sections) : !hidden.has(link.to)
  const sections = navSections
    .map((section) => ({ ...section, links: section.links.filter(visible) }))
    .filter((section) => section.links.length > 0)

  const choose = (id: string) => {
    const source = sources.find((s) => s.user.id === id)
    const next = source ? { id, username: source.user.username, sections: source.they_share } : null
    switchViewing(client, next)
    navigate(next ? firstTab(next.sections) : "/")
    onClose()
  }

  return (
    <>
      {/* Fundo escuro atrás do menu no celular. */}
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm sm:hidden" onClick={onClose} />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 transition-transform dark:border-white/10 dark:bg-[#0e1018]",
          "sm:sticky sm:top-0 sm:z-auto sm:h-screen sm:w-60 sm:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-lg shadow-orange-500/30">
            <Flame size={18} />
          </div>
          <span className="flex-1 text-lg font-semibold text-slate-900 dark:text-white">Smaug</span>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 sm:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {sources.length > 0 && (
          <Select
            aria-label="De quem são os dados"
            className="mb-5"
            value={viewing?.id ?? ""}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Meus dados</option>
            {sources.map((s) => (
              <option key={s.user.id} value={s.user.id}>
                Dados de {s.user.username}
              </option>
            ))}
          </Select>
        )}

        <nav className="flex flex-1 flex-col gap-5">
          {sections.map(({ title, links }) => (
            <div key={title ?? "inicio"} className="flex flex-col gap-1">
              {title && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {title}
                </p>
              )}
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === "/"} onClick={onClose} className={linkClass}>
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-6 flex flex-col gap-1 border-t border-slate-200 pt-4 dark:border-white/10">
          <NavLink to="/usuario" onClick={onClose} className={linkClass}>
            <CircleUser size={18} />
            <span className="truncate">{user?.username}</span>
          </NavLink>
          <NavLink to="/configuracoes" onClick={onClose} className={linkClass}>
            <Settings size={18} />
            Configurações
          </NavLink>
          <button onClick={logout} className={clsx(itemClass, idleClass)}>
            <LogOut size={18} />
            Sair
          </button>
          <p className="mt-2 px-3 font-mono text-[11px] text-slate-400 dark:text-slate-600">v{__APP_VERSION__}</p>
        </div>
      </aside>
    </>
  )
}
