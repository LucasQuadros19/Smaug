import { useSyncExternalStore } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { ShareSection } from "../types"

/** De quem são os dados na tela: null = os seus; senão, de quem compartilhou com você. */
export type Viewing = { id: string; username: string; sections: ShareSection[] }

let current: Viewing | null = null
const listeners = new Set<() => void>()

export function getViewing() {
  return current
}

export function setViewing(next: Viewing | null) {
  current = next
  listeners.forEach((listener) => listener())
}

/** Troca de quem são os dados: limpa o cache do anterior e busca de novo o que está na tela. */
export function switchViewing(client: QueryClient, next: Viewing | null) {
  setViewing(next)
  client.resetQueries({ predicate: (query) => !["me", "shares"].includes(String(query.queryKey[0])) })
}

export function useViewing() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, getViewing)
}
