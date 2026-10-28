import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import clsx from "clsx"
import { DatabaseBackup, Monitor, PanelLeft, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Card } from "../components/ui/Card"
import { Toggle } from "../components/ui/Toggle"
import { BackupSettings } from "../components/settings/BackupSettings"
import { MarketDefaults } from "../components/settings/MarketDefaults"
import { ScreenSettings, SystemSettings } from "../components/settings/SystemSettings"
import { useBackupConfig } from "../hooks/useBackup"
import { useHiddenTabs, useMe } from "../hooks/useMe"
import { navSections } from "../lib/navigation"

type Aba = { id: string; label: string; icon: LucideIcon }

const ABAS: Aba[] = [
  { id: "sistema", label: "Sistema", icon: Monitor },
  { id: "padroes", label: "Padrões", icon: SlidersHorizontal },
  { id: "barra", label: "Barra lateral", icon: PanelLeft },
  { id: "backup", label: "Backup", icon: DatabaseBackup },
]

export function Settings() {
  const [search, setSearch] = useSearchParams()
  const { data: backup } = useBackupConfig()
  const abas = ABAS.filter((a) => a.id !== "backup" || backup)
  const atual = abas.find((a) => a.id === search.get("aba"))?.id ?? "sistema"

  return (
    <>
      <Topbar title="Configurações" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div role="tablist" aria-label="Configurações" className="mb-5 flex max-w-2xl gap-1 border-b border-slate-200 dark:border-white/10">
          {abas.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={atual === id}
              onClick={() => setSearch(id === "sistema" ? {} : { aba: id }, { replace: true })}
              className={clsx(
                "-mb-px flex min-w-0 flex-1 flex-col items-center gap-1 border-b-2 px-2 py-2 text-xs font-medium transition-colors sm:flex-none sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm",
                atual === id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-slate-200"
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" className="space-y-4">
          {atual === "sistema" && (
            <>
              <SystemSettings />
              <ScreenSettings />
            </>
          )}
          {atual === "padroes" && <MarketDefaults />}
          {atual === "barra" && <SidebarTabs />}
          {atual === "backup" && <BackupSettings />}
        </div>
      </main>
    </>
  )
}

function SidebarTabs() {
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
    <Card className="max-w-2xl">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Abas da barra lateral</h3>
      <p className="mb-4 mt-1 text-xs text-slate-400">Esconder só tira a aba da barra. O endereço dela continua abrindo.</p>
      {hiddenTabs.error && <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{hiddenTabs.error.message}</p>}
      <div className="space-y-5">
        {navSections
          .filter((section) => section.title)
          .map(({ title, links }) => (
            <div key={title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {links.map(({ to, label, dev }) => (
                  <Toggle
                    key={to}
                    label={label}
                    hint={dev ? "Em desenvolvimento" : undefined}
                    checked={!hidden.has(to)}
                    onChange={(visible) => setVisible(to, visible)}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </Card>
  )
}
