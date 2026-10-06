import { api } from "./client"
import type { MarketKind, MarketOverview, MarketRange, MarketTrade, PortfolioPoint, PricePoint } from "../types"

export type TradeInput = {
  symbol_id: number
  side: "buy" | "sell"
  quantity: number
  price: number
  date: string
  account_id?: number | null
  notes?: string | null
}

export const marketApi = {
  overview: () => api.get<MarketOverview>("/market"),
  addSymbol: (code: string, kind: MarketKind) => api.post("/market/symbols", { code, kind }),
  removeSymbol: (id: number) => api.delete(`/market/symbols/${id}`),
  addTrade: (data: TradeInput) => api.post<MarketTrade>("/market/trades", data),
  removeTrade: (id: number) => api.delete(`/market/trades/${id}`),
  history: (id: number, range: MarketRange) =>
    api.get<PricePoint[]>(`/market/symbols/${id}/history`, { params: { range } }),
  portfolioHistory: (range: MarketRange) =>
    api.get<PortfolioPoint[]>("/market/portfolio/history", { params: { range } }),
}
