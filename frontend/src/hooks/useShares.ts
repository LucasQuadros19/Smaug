import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sharesApi } from "../api/shares"
import { setViewing, switchViewing, useViewing } from "../lib/viewing"
import type { ShareSection } from "../types"

export function useShares() {
  return useQuery({ queryKey: ["shares"], queryFn: sharesApi.list })
}

export function useShareMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ["shares"] })
  type Change = { id: number; sections: ShareSection[] }

  return {
    invite: useMutation({ mutationFn: sharesApi.invite, onSuccess: invalidate }),
    accept: useMutation({ mutationFn: ({ id, sections }: Change) => sharesApi.accept(id, sections), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, sections }: Change) => sharesApi.update(id, sections), onSuccess: invalidate }),
    end: useMutation({ mutationFn: (id: number) => sharesApi.end(id), onSuccess: invalidate }),
  }
}

/** Quem mostra algo para você. Se a pessoa mudar ou encerrar, a tela acompanha. */
export function useSharedWithMe() {
  const client = useQueryClient()
  const viewing = useViewing()
  const { data: shares } = useShares()
  const sources = (shares ?? []).filter((share) => share.status === "active" && share.they_share.length > 0)

  useEffect(() => {
    if (!viewing || !shares) return
    const source = shares.find((s) => s.status === "active" && s.user.id === viewing.id && s.they_share.length > 0)
    if (!source) switchViewing(client, null)
    else if (source.they_share.join() !== viewing.sections.join()) setViewing({ ...viewing, sections: source.they_share })
  }, [client, shares, viewing])

  return sources
}
