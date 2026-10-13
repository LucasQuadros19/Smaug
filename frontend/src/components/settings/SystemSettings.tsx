import { Card } from "../ui/Card"
import { Label, Select } from "../ui/Input"
import { SegmentedControl } from "../ui/SegmentedControl"
import { Toggle } from "../ui/Toggle"
import { useTheme } from "../../context/ThemeContext"
import { useSettings } from "../../hooks/useMe"
import { navSections } from "../../lib/navigation"
import type { Settings } from "../../types"

export function SystemSettings() {
  const { settings, set, error } = useSettings()
  const { setPreference } = useTheme()
  const pages = navSections.flatMap((section) => section.links)

  return (
    <Card className="max-w-2xl space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sistema</h3>
        <p className="mt-1 text-xs text-slate-400">Ficam na sua conta: valem em qualquer aparelho.</p>
        {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Tema</Label>
          <SegmentedControl<Settings["theme"]>
            ariaLabel="Tema"
            value={settings.theme}
            onChange={(theme) => {
              setPreference(theme)
              set({ theme })
            }}
            options={[
              { value: "dark", label: "Escuro" },
              { value: "light", label: "Claro" },
              { value: "system", label: "Do aparelho" },
            ]}
          />
        </div>
        <div>
          <Label>Semana começa</Label>
          <SegmentedControl<"sun" | "mon">
            ariaLabel="Semana começa"
            value={settings.week_starts_monday ? "mon" : "sun"}
            onChange={(day) => set({ week_starts_monday: day === "mon" })}
            options={[
              { value: "sun", label: "Domingo" },
              { value: "mon", label: "Segunda" },
            ]}
          />
        </div>
        <div>
          <Label htmlFor="start-page">Abrir em</Label>
          <Select id="start-page" value={settings.start_page} onChange={(e) => set({ start_page: e.target.value })}>
            {pages.map(({ to, label }) => (
              <option key={to} value={to}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Toggle
        label="Esconder valores"
        hint="Mostra R$ ••• no lugar dos valores, para abrir em público."
        checked={settings.hide_values}
        onChange={(hide_values) => set({ hide_values })}
      />
    </Card>
  )
}
