import { useSettings } from "../../hooks/useMe"
import { nextBusinessDay, notBusinessReason } from "../../lib/businessDays"
import { formatDate } from "../../lib/format"

/** Vencimento em fim de semana ou feriado: avisa e oferece o próximo dia útil (se ligado nas Configurações). */
export function BusinessDayHint({ date, onPick }: { date: string; onPick: (day: string) => void }) {
  const { settings } = useSettings()
  const reason = settings.business_days && date ? notBusinessReason(date) : null
  if (!reason) return null
  const next = nextBusinessDay(date)
  return (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
      {reason === "Sábado" || reason === "Domingo" ? `Cai num ${reason.toLowerCase()}` : `Cai em feriado: ${reason}`}.{" "}
      <button type="button" onClick={() => onPick(next)} className="font-medium underline">
        Usar {formatDate(next)}
      </button>
    </p>
  )
}
