import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { authApi, type Credentials } from "../api/auth"
import { setViewing } from "../lib/viewing"
import type { User } from "../types"

const ME = ["me"]

export function useMe() {
  return useQuery({ queryKey: ME, queryFn: authApi.me, staleTime: Infinity, retry: false })
}

/** Ao trocar de usuário, nada do anterior pode sobrar no cache. */
export function setSessionUser(client: QueryClient, user: User | null) {
  setViewing(null)
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== ME[0] })
  client.setQueryData(ME, user)
}

export function useAuthActions() {
  const client = useQueryClient()
  return {
    login: (data: Credentials) => authApi.login(data).then((user) => setSessionUser(client, user)),
    signup: (data: Credentials) => authApi.signup(data).then((user) => setSessionUser(client, user)),
    logout: () =>
      authApi
        .logout()
        .catch(() => undefined)
        .then(() => setSessionUser(client, null)),
    changePassword: authApi.changePassword,
  }
}

export function useHiddenTabs() {
  const client = useQueryClient()
  const save = useMutation({
    // Em fila: cliques rápidos chegam ao servidor na ordem em que foram feitos.
    scope: { id: "hidden-tabs" },
    mutationFn: authApi.updateHiddenTabs,
    onError: () => client.invalidateQueries({ queryKey: ME }),
  })
  const set = (hidden_tabs: string[]) => {
    client.setQueryData<User | null>(ME, (user) => user && { ...user, hidden_tabs })
    save.mutate(hidden_tabs)
  }
  return { set, error: save.error }
}
