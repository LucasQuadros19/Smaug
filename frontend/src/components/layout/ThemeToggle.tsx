import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { useSettings } from "../../hooks/useMe"

export function ThemeToggle() {
  const { theme, setPreference } = useTheme()
  const { set } = useSettings()
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark"
    setPreference(next)
    set({ theme: next })
  }

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
      aria-label="Alternar tema"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
