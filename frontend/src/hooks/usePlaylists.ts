import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { playlistsApi, type PlaylistInput } from "../api/playlists"

export function usePlaylists() {
  // Cotação ao vivo para posições em outra moeda (o backend renova a cada minuto).
  return useQuery({ queryKey: ["playlists"], queryFn: playlistsApi.list, refetchInterval: 60_000 })
}

export function usePlaylist(id: number) {
  return useQuery({ queryKey: ["playlists", id], queryFn: () => playlistsApi.get(id) })
}

export function usePlaylistMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["playlists"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  }

  const create = useMutation({
    mutationFn: (data: PlaylistInput) => playlistsApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlaylistInput> }) =>
      playlistsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => playlistsApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
