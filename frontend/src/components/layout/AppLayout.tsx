import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Menu } from "lucide-react"
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

  return (
    <MenuContext.Provider value={() => setMenuOpen(true)}>
      <div className="flex min-h-screen bg-slate-100 dark:bg-[#0b0d14]">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        {/* min-w-0: sem isso um filho largo (tabela) empurra o layout e faz a
            página inteira rolar na horizontal em vez de rolar dentro do card. */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MenuContext.Provider>
  )
}
