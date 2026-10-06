import { useEffect } from "react"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "./context/ThemeContext"
import { recurringApi } from "./api/recurring"
import { router } from "./router"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AutoGenerateRecurring />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
