import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { marketApi, type TradeInput } from "../api/market"
import type { MarketKind, MarketRange } from "../types"

export function useMarket() {
  // O servidor guarda a cotação por 1 minuto; buscar mais que isso não traz nada novo.
  return useQuery({ queryKey: ["market"], queryFn: marketApi.overview, refetchInterval: 60_000 })
}

export function useSymbolHistory(id: number, range: MarketRange) {
  return useQuery({
    queryKey: ["market", "history", id, range],
    queryFn: () => marketApi.history(id, range),
    staleTime: range === "1d" || range === "5d" ? 5 * 60_000 : 60 * 60_000,
  })
}

export function usePortfolioHistory(range: MarketRange, enabled: boolean) {
  return useQuery({
    queryKey: ["market", "portfolio", range],
    queryFn: () => marketApi.portfolioHistory(range),
    staleTime: 60 * 60_000,
    enabled,
  })
}

export function useMarketMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["market"] })
    // Compra com conta mexe no saldo.
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  const addSymbol = useMutation({
    mutationFn: ({ code, kind }: { code: string; kind: MarketKind }) => marketApi.addSymbol(code, kind),
    onSuccess: invalidate,
  })
  const removeSymbol = useMutation({ mutationFn: (id: number) => marketApi.removeSymbol(id), onSuccess: invalidate })
  const addTrade = useMutation({ mutationFn: (data: TradeInput) => marketApi.addTrade(data), onSuccess: invalidate })
  const removeTrade = useMutation({ mutationFn: (id: number) => marketApi.removeTrade(id), onSuccess: invalidate })

  return { addSymbol, removeSymbol, addTrade, removeTrade }
}
