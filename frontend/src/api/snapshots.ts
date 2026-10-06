import { api } from "./client"
import type { Paginated, Snapshot, SnapshotEntryInput, TransferRef } from "../types"

export type TransferInput = {
  from: TransferRef
  to: TransferRef
  amount: number
  date: string
  notes?: string | null
}

export type SnapshotInput = {
  date: string
  inflow?: number
  notes?: string | null
  entries: SnapshotEntryInput[]
}

export type SettleInput = {
  from: TransferRef
  to_account_id: number
  received: number
  reduce_by?: number | null
  date: string
  notes?: string | null
}

export type InvestInput = {
  to: TransferRef
  from_account_id: number
  amount: number
  date: string
  notes?: string | null
}

export const snapshotsApi = {
  invest: (data: InvestInput) =>
    api.post<Snapshot>("/snapshots/invest", data),
  settle: (data: SettleInput) =>
    api.post<Snapshot & { realized_gain: number }>("/snapshots/settle", data),
  list: (params: { page?: number; per_page?: number } = {}) =>
    api.get<Paginated<Snapshot>>("/snapshots", { params }),
  create: (data: SnapshotInput) => api.post<Snapshot>("/snapshots", data),
  transfer: (data: TransferInput) =>
    api.post<Snapshot>("/snapshots/transfer", data),
  remove: (id: number) => api.delete(`/snapshots/${id}`),
}
