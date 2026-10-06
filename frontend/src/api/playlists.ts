import { api } from "./client"
import type { AssetType, Currency, PositionHistory, Playlist, PlaylistKind } from "../types"

export type PlaylistInput = {
  name: string
  description?: string | null
  color: string
  icon: string
  kind: PlaylistKind
  counts_in_net_worth: boolean
  opening_value?: number
  currency?: Currency
  auto_source?: string | null
  asset_type?: AssetType
}

export const playlistsApi = {
  history: (id: number) =>
    api.get<PositionHistory>(`/playlists/${id}/history`),
  list: () => api.get<Playlist[]>("/playlists"),
  get: (id: number) => api.get<Playlist>(`/playlists/${id}`),
  create: (data: PlaylistInput) => api.post<Playlist>("/playlists", data),
  update: (id: number, data: Partial<PlaylistInput>) =>
    api.put<Playlist>(`/playlists/${id}`, data),
  remove: (id: number) => api.delete(`/playlists/${id}`),
}
