import { useEffect } from "react"
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ApiError } from "./api/client"
import { ThemeProvider } from "./context/ThemeContext"
import { recurringApi } from "./api/recurring"
import { setSessionUser, useMe } from "./hooks/useMe"
import { getViewing } from "./lib/viewing"
import { Login } from "./pages/Login"
import { router } from "./router"

function onError(error: Error) {
  if (!(error instanceof ApiError)) return
  // Sessão expirada (ou encerrada em outro aparelho): volta para o login.
  if (error.status === 401) setSessionUser(queryClient, null)
  // Nos dados de outra pessoa, 403 é sinal de que ela mudou o que mostra.
  else if (error.status === 403 && getViewing()) queryClient.invalidateQueries({ queryKey: ["shares"] })
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Erro do pedido (4xx) não melhora tentando de novo.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 3,
    },
  },
})

function AutoGenerateRecurring() {
  const client = useQueryClient()

  useEffect(() => {
    recurringApi
      .generate()
      .then((result) => {
        if (result.generated > 0) {
          client.invalidateQueries()
        }
      })
      .catch(() => {})
  }, [client])

  return null
}

function Gate() {
  const { data: user, isPending } = useMe()
  if (isPending) return null
  if (!user) return <Login />
  return (
    <>
      <AutoGenerateRecurring />
      <RouterProvider router={router} />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Gate />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
