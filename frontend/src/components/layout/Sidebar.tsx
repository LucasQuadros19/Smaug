import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PiggyBank,
  Repeat,
  FolderKanban,
  Target,
  Landmark,
  ShoppingCart,
  Table2,
  HandCoins,
  Flame,
  X,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import clsx from "clsx"

// Vem do package.json (vite.config.ts).
declare const __APP_VERSION__: string

const sections = [
  {
    title: null,
    links: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Dia a dia",
    links: [
      { to: "/transacoes", label: "Transações", icon: ArrowLeftRight },
      { to: "/recorrentes", label: "Recorrentes", icon: Repeat },
      { to: "/orcamentos", label: "Orçamentos", icon: PiggyBank },
      { to: "/lista-compras", label: "Lista de compras", icon: ShoppingCart },
    ],
  },
  {
    title: "Patrimônio",
    links: [
      { to: "/patrimonio", label: "Evolução", icon: Table2 },
      { to: "/ativos", label: "Ativos", icon: Landmark },
      { to: "/emprestimos", label: "Empréstimos", icon: HandCoins },
      { to: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    title: "Organização",
    links: [
      { to: "/grupos", label: "Grupos", icon: FolderKanban },
      { to: "/contas", label: "Contas", icon: Wallet },
      { to: "/categorias", label: "Categorias", icon: Tags },
    ],
  },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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

        <nav className="flex flex-1 flex-col gap-5">
          {sections.map(({ title, links }) => (
            <div key={title ?? "inicio"} className="flex flex-col gap-1">
              {title && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {title}
                </p>
              )}
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                    )
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <p className="mt-6 px-3 font-mono text-[11px] text-slate-400 dark:text-slate-600">
          v{__APP_VERSION__}
        </p>
      </aside>
    </>
  )
}
