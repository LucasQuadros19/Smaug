import { useQuery } from "@tanstack/react-query"
import { playlistsApi } from "../api/playlists"

export function usePositionHistory(id: number) {
  return useQuery({
    queryKey: ["playlists", id, "history"],
    queryFn: () => playlistsApi.history(id),
    enabled: Number.isFinite(id) && id > 0,
  })
}
