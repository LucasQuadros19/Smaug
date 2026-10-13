import { useId, type ReactNode } from "react"
import clsx from "clsx"
import { Input, Label, Select } from "../ui/Input"
import { COINS, DEFAULT_CONFIG, TIMEFRAME_SHORT, chipClasses, coin, withStrategy } from "../../lib/bot"
import type { BotCatalog, BotConfig, BotParams, BotTimeframe } from "../../types"

const FIELDS: { key: keyof BotParams; label: string; min: number; max: number; step: string }[] = [
  { key: "ema_rapida", label: "EMA rápida", min: 1, max: 500, step: "1" },
  { key: "ema_lenta", label: "EMA lenta", min: 1, max: 500, step: "1" },
  { key: "qtd_velas_stop", label: "Velas do stop", min: 2, max: 200, step: "1" },
  { key: "risco_retorno", label: "Alvo (× o risco)", min: 0.1, max: 20, step: "0.1" },
]

/** Campo vazio vira NaN: o navegador barra o envio (required) em vez de mandar 0. */
const shown = (value: number) => (Number.isNaN(value) ? "" : value)

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {children}
    </div>
  )
}

function rule(side: "compra" | "venda" | "ambos", p: BotParams) {
  const stop = `Stop no extremo das últimas ${shown(p.qtd_velas_stop)} velas; alvo a ${shown(p.risco_retorno)}× a distância até o stop.`
  if (side === "compra") return `Compra quando a vela anterior fecha acima das duas EMAs e a atual passa da máxima dela. ${stop}`
  if (side === "venda") return `Vende quando a vela anterior fecha abaixo das duas EMAs e a atual perde a mínima dela. ${stop}`
  return `Compra quando a vela anterior fecha acima das duas EMAs e a atual passa da máxima; vende no contrário. ${stop}`
}

function ParamsBox({
  title,
  side,
  value,
  onChange,
  catalog,
}: {
  title: string
  side: "compra" | "venda" | "ambos"
  value: BotParams
  onChange: (value: BotParams) => void
  catalog: BotCatalog
}) {
  const id = useId()
  return (
    <div role="group" aria-label={title} className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
      <div className="grid grid-cols-[auto_1fr] items-center gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
        <Select
          aria-label={`Parâmetros prontos para ${title.toLowerCase()}`}
          value=""
          onChange={(e) => {
            const ready = catalog.prontos[Number(e.target.value)]
            if (ready) onChange(ready.parametros)
          }}
        >
          <option value="">Usar parâmetros prontos…</option>
          {catalog.prontos.map((ready, i) => (
            <option key={ready.nome} value={i}>
              {ready.nome}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <Label htmlFor={`${id}-${field.key}`}>{field.label}</Label>
            <Input
              id={`${id}-${field.key}`}
              type="number"
              inputMode="decimal"
              required
              min={field.min}
              max={field.max}
              step={field.step}
              value={shown(value[field.key])}
              onChange={(e) => onChange({ ...value, [field.key]: e.target.valueAsNumber })}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">{rule(side, value)}</p>
    </div>
  )
}

export function ConfigFields({
  value,
  onChange,
  catalog,
}: {
  value: BotConfig
  onChange: (value: BotConfig) => void
  catalog: BotCatalog
}) {
  const id = useId()
  const set = (patch: Partial<BotConfig>) => onChange({ ...value, ...patch })
  const other = COINS.includes(coin(value.cripto)) ? "" : coin(value.cripto)
  const byBalance = value.risco_pct == null

  return (
    <div className="space-y-5">
      <Group label="Script">
        <div role="radiogroup" aria-label="Script" className="space-y-1.5">
          {catalog.estrategias.map((strategy) => {
            const selected = strategy.id === value.estrategia
            return (
              <button
                key={strategy.id}
                type="button"
                role="radio"
                aria-checked={selected}
                title={strategy.descricao}
                onClick={() => onChange(withStrategy(value, strategy.id, catalog))}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
                    : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
                )}
              >
                <span
                  className={clsx(
                    "mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-indigo-500 dark:border-indigo-400" : "border-slate-300 dark:border-white/20"
                  )}
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{strategy.nome}</span>
                  <span className="block break-all font-mono text-[10px] leading-snug text-slate-400">{strategy.script}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Moeda">
        <div className="flex flex-wrap items-center gap-1.5">
          {COINS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={value.cripto === `${c}USDT`}
              onClick={() => set({ cripto: `${c}USDT` })}
              className={chipClasses(value.cripto === `${c}USDT`)}
            >
              {c}
            </button>
          ))}
          <input
            aria-label="Outra moeda"
            placeholder="Outra"
            value={other}
            maxLength={20}
            onChange={(e) => {
              const typed = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/USDT$/, "")
              set({ cripto: typed ? `${typed}USDT` : DEFAULT_CONFIG.cripto })
            }}
            className={clsx(
              chipClasses(other !== ""),
              "w-24 bg-transparent placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            )}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Contrato <span className="font-mono">{value.cripto}</span> da Bybit
        </p>
      </Group>

      <Group label="Tempo gráfico">
        <div className="flex flex-wrap gap-1.5">
          {catalog.tempos.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={value.tempo_grafico === t.valor}
              title={t.nome}
              onClick={() => set({ tempo_grafico: t.valor as BotTimeframe })}
              className={clsx(chipClasses(value.tempo_grafico === t.valor), "min-w-11")}
            >
              {TIMEFRAME_SHORT[t.valor]}
            </button>
          ))}
        </div>
      </Group>

      {value.compra && (
        <ParamsBox
          title={value.estrategia === "long_short" ? "Compra e venda" : "Compra"}
          side={value.estrategia === "long_short" ? "ambos" : "compra"}
          value={value.compra}
          onChange={(compra) => set({ compra })}
          catalog={catalog}
        />
      )}
      {value.venda && value.estrategia !== "long_short" && (
        <ParamsBox title="Venda" side="venda" value={value.venda} onChange={(venda) => set({ venda })} catalog={catalog} />
      )}

      <div>
        <div className="grid grid-cols-3 items-end gap-3">
          <div>
            <Label htmlFor={`${id}-tamanho`}>Tamanho</Label>
            <Select
              id={`${id}-tamanho`}
              value={byBalance ? "saldo" : "risco"}
              onChange={(e) => set({ risco_pct: e.target.value === "saldo" ? null : 1 })}
            >
              <option value="risco">Risco fixo</option>
              <option value="saldo">Saldo inteiro</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${id}-risco`}>Risco (%)</Label>
            <Input
              id={`${id}-risco`}
              type="number"
              inputMode="decimal"
              required={!byBalance}
              disabled={byBalance}
              min={0.1}
              max={10}
              step={0.1}
              placeholder="—"
              value={byBalance ? "" : shown(value.risco_pct!)}
              onChange={(e) => set({ risco_pct: e.target.valueAsNumber })}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-alavancagem`}>Alavancagem</Label>
            <Input
              id={`${id}-alavancagem`}
              type="number"
              inputMode="decimal"
              required
              min={1}
              max={10}
              step={0.5}
              value={shown(value.alavancagem)}
              onChange={(e) => set({ alavancagem: e.target.valueAsNumber })}
            />
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          {byBalance
            ? "Como os scripts antigos: toda operação usa o saldo todo, então um stop 3% abaixo leva 3% da conta."
            : `Cada stop leva ${shown(value.risco_pct!)}% do saldo (um gap pode passar um pouco).`}{" "}
          A posição nunca passa de saldo × alavancagem.
        </p>
      </div>
    </div>
  )
}
