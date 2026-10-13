import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "dark" | "light"
export type ThemePreference = Theme | "system"

interface ThemeContextValue {
  /** O tema que está na tela (com "system", o do aparelho). */
  theme: Theme
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const DARK_QUERY = "(prefers-color-scheme: dark)"

// A escolha fica na conta (Configurações); aqui é só a cópia para a tela de login e o primeiro desenho.
function getInitialPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem("theme")
    if (stored === "light" || stored === "dark" || stored === "system") return stored
  } catch {
    // armazenamento bloqueado (aba anônima, política do navegador): usa o padrão
  }
  return "dark"
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference)
  const [system, setSystem] = useState<Theme>(systemTheme)
  const theme = preference === "system" ? system : preference

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => setSystem(systemTheme())
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      localStorage.setItem("theme", preference)
    } catch {
      // sem armazenamento: o tema só não fica lembrado neste aparelho
    }
  }, [theme, preference])

  return <ThemeContext.Provider value={{ theme, preference, setPreference }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider")
  return ctx
}
