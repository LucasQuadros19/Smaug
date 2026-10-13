import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Construction } from "lucide-react"
import { Topbar } from "../components/layout/Topbar"
import { Robots } from "../components/bot/Robots"
import { Simulations } from "../components/bot/Simulations"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { SegmentedControl } from "../components/ui/SegmentedControl"
import { useBotCatalog } from "../hooks/useBot"
import { useMe } from "../hooks/useMe"
import type { BotConfig } from "../types"

type Tab = "robos" | "simulacoes"

function Unavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { data: me } = useMe()
  return (
    <Card className="max-w-2xl space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">O bot não está disponível</h3>
        <p className="mt-1 text-rose-600 dark:text-rose-400">{message}</p>
      </div>
      <p>Para ligar esta tela ao bot (uma vez só):</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-xs">
        <li>
          No <span className="font-mono">bot-trader</span>, crie o <span className="font-mono">.env</span> a partir do{" "}
          <span className="font-mono">.env.example</span>: as chaves da Bybit e um <span className="font-mono">BOT_API_TOKEN</span>{" "}
          (gere com <span className="font-mono">openssl rand -hex 32</span>).
        </li>
        <li>
          No <span className="font-mono">backend/.env</span> do Smaug: <span className="font-mono">BOT_API_TOKEN</span> com o mesmo valor e{" "}
          <span className="font-mono">BOT_USERS={me?.username ?? "seu_usuario"}</span>.
        </li>
        <li>
          Rode o <span className="font-mono">./start.sh</span> de novo: ele sobe o bot junto quando acha{" "}
          <span className="font-mono">../bot-trader/venv</span>.
        </li>
      </ol>
      <Button variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </Card>
  )
}

export function BotPage() {
  const [search, setSearch] = useSearchParams()
  const tab: Tab = search.get("aba") === "simulacoes" ? "simulacoes" : "robos"
  const setTab = (next: Tab) => setSearch(next === "robos" ? {} : { aba: next }, { replace: true })
  const catalog = useBotCatalog()
  const [draft, setDraft] = useState<BotConfig | null>(null)

  return (
    <>
      <Topbar
        title="Bot"
        action={
          <SegmentedControl<Tab>
            ariaLabel="Parte do bot"
            value={tab}
            onChange={setTab}
            options={[
              { value: "robos", label: "Robôs" },
              { value: "simulacoes", label: "Simulações" },
            ]}
          />
        }
      />
      <main className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <Construction size={16} className="mt-0.5 shrink-0" /> Em desenvolvimento
        </p>
        {catalog.error ? (
          <Unavailable message={catalog.error.message} onRetry={() => catalog.refetch()} />
        ) : !catalog.data ? (
          <p className="text-sm text-slate-400">Falando com o bot...</p>
        ) : (
          <>
            {/* As duas ficam montadas: trocar de aba não perde o formulário nem a comparação. */}
            <div hidden={tab !== "robos"}>
              <Robots catalog={catalog.data} draft={draft} />
            </div>
            <div hidden={tab !== "simulacoes"}>
              <Simulations
                catalog={catalog.data}
                onUseInRobot={(config) => {
                  setDraft({ ...config })
                  setTab("robos")
                }}
              />
            </div>
          </>
        )}
      </main>
    </>
  )
}
