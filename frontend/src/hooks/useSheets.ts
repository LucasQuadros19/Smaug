import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sheetsApi } from "../api/sheets"
import { slug } from "../lib/calc"
import { currentMonth } from "../lib/format"
import { useAccounts } from "./useAccounts"
import { useDashboardSummary, useRates } from "./useDashboard"
import { useLoans } from "./useLoans"
import { useMarket } from "./useMarket"
import { usePlaylists } from "./usePlaylists"
import type { Sheet } from "../types"

export function useSheets() {
  return useQuery({ queryKey: ["sheets"], queryFn: sheetsApi.list })
}

export function useSheetMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sheets"] })

  const create = useMutation({ mutationFn: (title?: string) => sheetsApi.create(title), onSuccess: invalidate })
  // Salvar enquanto digita não recarrega a lista (apagaria o que está sendo
  // digitado): só atualiza o cache com o que o servidor guardou.
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<Sheet, "title" | "content">> }) =>
      sheetsApi.update(id, data),
    onSuccess: (saved) =>
      queryClient.setQueryData<Sheet[]>(["sheets"], (prev) => prev?.map((s) => (s.id === saved.id ? saved : s))),
  })
  const remove = useMutation({ mutationFn: (id: number) => sheetsApi.remove(id), onSuccess: invalidate })

  return { create, update, remove }
}

export type CalcRef = { key: string; value: number; hint: string }

/** Nomes do sistema que viram @referências nas folhas, com o valor de agora. */
export function useCalcRefs(): CalcRef[] {
  const { data: loans } = useLoans()
  const { data: playlists } = usePlaylists()
  const { data: accounts } = useAccounts()
  const { data: rates } = useRates()
  const { data: summary } = useDashboardSummary(currentMonth())
  const { data: market } = useMarket()

  return useMemo(() => {
    const refs: CalcRef[] = []
    const add = (key: string, value: number, hint: string) => refs.push({ key, value, hint })
    // Dois empréstimos para o mesmo "Pedro" viram pedro e pedro_2.
    const unique = (base: string, used: Set<string>) => {
      let key = base || "sem_nome"
      for (let n = 2; used.has(key); n++) key = `${base}_${n}`
      used.add(key)
      return key
    }

    if (rates) {
      add("dolar", rates.USD?.rate ?? 0, "cotação do dólar em R$")
      add("euro", rates.EUR?.rate ?? 0, "cotação do euro em R$")
      add("bitcoin", rates.BTC?.rate ?? 0, "cotação do bitcoin em R$")
    }
    if (summary) {
      add("patrimonio", summary.net_worth, "patrimônio total")
      add("disponivel", summary.total_balance, "disponível em contas")
    }

    const usedAccounts = new Set<string>()
    for (const a of accounts ?? []) add(`conta.${unique(slug(a.name), usedAccounts)}`, a.balance ?? 0, `saldo de ${a.name}`)

    const usedAssets = new Set<string>()
    const usedGroups = new Set<string>()
    for (const p of playlists ?? []) {
      const asset = p.kind === "asset"
      const key = unique(slug(p.name), asset ? usedAssets : usedGroups)
      add(`${asset ? "ativo" : "grupo"}.${key}`, p.outstanding ?? p.opening_value, `valor de ${p.name}`)
    }

    const usedLoans = new Set<string>()
    for (const loan of loans ?? []) {
      const base = `emprestimo.${unique(slug(loan.borrower), usedLoans)}`
      add(base, loan.amount, `emprestado para ${loan.borrower}`)
      add(`${base}.recebe`, loan.total_to_receive, `total a receber de ${loan.borrower}`)
      add(`${base}.lucro`, loan.profit, `lucro do empréstimo de ${loan.borrower}`)
      if (loan.commission > 0) add(`${base}.comissao`, loan.commission, "minha comissão")
      const usedPeople = new Set(["recebe", "lucro", "comissao"])
      for (const p of loan.participants) {
        const person = `${base}.${unique(slug(p.name), usedPeople)}`
        add(person, p.contributed, `${p.name} colocou`)
        add(`${person}.recebe`, p.to_receive, `${p.name} recebe`)
      }
    }
    if (market) {
      add("carteira", market.portfolio.value_brl, "minha carteira no Mercado, em R$")
      for (const s of market.symbols) {
        const code = slug(s.code)
        const prefix = s.kind === "crypto" ? "cripto" : "acao"
        if (s.quote && s.rate != null) add(`${prefix}.${code}`, s.quote.price * s.rate, `preço de ${s.code} em R$`)
        if (s.quote && s.currency !== "BRL") add(`${prefix}.${code}.${slug(s.currency)}`, s.quote.price, `preço de ${s.code} em ${s.currency}`)
        if (s.holding && s.holding.quantity > 0) {
          add(`carteira.${code}`, s.holding.value_brl ?? 0, `quanto tenho de ${s.code}, em R$`)
          add(`carteira.${code}.quantidade`, s.holding.quantity, `quantas ${s.code} tenho`)
        }
      }
    }
    return refs
  }, [loans, playlists, accounts, rates, summary, market])
}
