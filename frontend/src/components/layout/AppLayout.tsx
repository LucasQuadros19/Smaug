import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Menu, Users } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation } from "react-router-dom"
import { canSee, sectionOfPath } from "../../lib/navigation"
import { switchViewing, useViewing } from "../../lib/viewing"
import { Sidebar } from "./Sidebar"

const MenuContext = createContext<() => void>(() => {})

/** Botão que abre o menu no celular; no desktop a barra lateral já está fixa. */
export function MenuButton() {
  const open = useContext(MenuContext)
  return (
    <button
      onClick={open}
      aria-label="Abrir menu"
      className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 sm:hidden"
    >
      <Menu size={20} />
    </button>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])

  const client = useQueryClient()
  const viewing = useViewing()
  const section = sectionOfPath(useLocation().pathname)
  // O backend já recusa; aqui é só para não abrir uma tela quebrada.
  const blocked = viewing !== null && section !== undefined && !canSee(section, viewing.sections)

  return (
    <MenuContext.Provider value={() => setMenuOpen(true)}>
      <div className="flex min-h-screen bg-slate-100 dark:bg-[#0b0d14]">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        {/* min-w-0: sem isso um filho largo (tabela) empurra o layout e faz a
            página inteira rolar na horizontal em vez de rolar dentro do card. */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {viewing && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-500/15 px-4 py-2 text-sm text-amber-800 sm:px-6 dark:text-amber-200">
              <Users size={16} className="shrink-0" />
              <span className="flex-1">
                Dados de <strong>{viewing.username}</strong>. O que você mudar aqui muda também para {viewing.username}.
              </span>
              <button onClick={() => switchViewing(client, null)} className="font-medium underline">
                Voltar aos meus dados
              </button>
            </div>
          )}
          {blocked ? (
            <>
              <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-white/10">
                <MenuButton />
                <h1 className="text-lg font-semibold text-slate-900 sm:text-xl dark:text-white">Sem acesso</h1>
              </header>
              <p className="p-4 text-sm text-slate-500 sm:p-6 dark:text-slate-400">
                {viewing.username} não compartilhou esta parte com você.
              </p>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </MenuContext.Provider>
  )
}
