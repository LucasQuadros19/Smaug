import { useState } from "react"
import { Topbar } from "../components/layout/Topbar"
import { Card } from "../components/ui/Card"
import { Toggle } from "../components/ui/Toggle"
import { useHiddenTabs, useMe } from "../hooks/useMe"
import { navSections } from "../lib/navigation"

export function Settings() {
  const { data: user } = useMe()
  const hiddenTabs = useHiddenTabs()
  // Estado local para o checkbox responder no clique; a barra lateral segue pelo cache.
  const [hidden, setHidden] = useState(() => new Set(user?.hidden_tabs))

  const setVisible = (to: string, visible: boolean) => {
    const next = new Set(hidden)
    if (visible) next.delete(to)
    else next.add(to)
    setHidden(next)
    hiddenTabs.set([...next])
  }

  return (
    <>
      <Topbar title="Configurações" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card className="max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Abas da barra lateral</h3>
          <p className="mb-4 mt-1 text-xs text-slate-400">
            Esconder só tira a aba da barra. O endereço dela continua abrindo.
          </p>
          {hiddenTabs.error && (
            <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{hiddenTabs.error.message}</p>
          )}
          <div className="space-y-5">
            {navSections
              .filter((section) => section.title)
              .map(({ title, links }) => (
                <div key={title}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {title}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {links.map(({ to, label }) => (
                      <Toggle
                        key={to}
                        label={label}
                        checked={!hidden.has(to)}
                        onChange={(visible) => setVisible(to, visible)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </main>
    </>
  )
}
