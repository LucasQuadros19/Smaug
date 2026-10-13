import { useEffect } from "react"
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ApiError } from "./api/client"
import { ThemeProvider, useTheme } from "./context/ThemeContext"
import { ConfirmProvider } from "./components/ui/ConfirmDialog"
import { Toaster } from "./components/ui/Toaster"
import { recurringApi } from "./api/recurring"
import { setSessionUser, useMe } from "./hooks/useMe"
import { setHideValues } from "./lib/format"
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
  const { setPreference } = useTheme()
  const theme = user?.settings.theme
  useEffect(() => {
    if (theme) setPreference(theme)
  }, [theme, setPreference])
  // Ao entrar (login ou recarregar no Dashboard), abre a aba escolhida.
  const startPage = user?.settings.start_page
  useEffect(() => {
    if (startPage && startPage !== "/" && router.state.location.pathname === "/") router.navigate(startPage, { replace: true })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return null
  if (!user) return <Login />
  setHideValues(user.settings.hide_values)
  return (
    <>
      <AutoGenerateRecurring />
      {/* Trocar "esconder valores" redesenha as telas com o formato novo. */}
      <RouterProvider key={String(user.settings.hide_values)} router={router} />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfirmProvider>
          <Gate />
        </ConfirmProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
