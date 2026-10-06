import { Suspense, lazy, type ComponentType } from "react"
import { Navigate, createBrowserRouter } from "react-router-dom"
import { AppLayout } from "./components/layout/AppLayout"

// Cada tela é um arquivo à parte: abrir uma não baixa as outras (nem os gráficos).
function page(load: () => Promise<ComponentType>) {
  const Page = lazy(() => load().then((component) => ({ default: component })))
  return (
    <AppLayout>
      <Suspense fallback={<p className="p-6 text-sm text-slate-400">Carregando...</p>}>
        <Page />
      </Suspense>
    </AppLayout>
  )
}

const playlistDetail = () => import("./pages/PlaylistDetail").then((m) => m.PlaylistDetail)

export const router = createBrowserRouter([
  { path: "/", element: page(() => import("./pages/Dashboard").then((m) => m.Dashboard)) },
  { path: "/transacoes", element: page(() => import("./pages/Transactions").then((m) => m.Transactions)) },
  { path: "/contas", element: page(() => import("./pages/Accounts").then((m) => m.Accounts)) },
  { path: "/categorias", element: page(() => import("./pages/Categories").then((m) => m.Categories)) },
  { path: "/orcamentos", element: page(() => import("./pages/Budgets").then((m) => m.Budgets)) },
  { path: "/recorrentes", element: page(() => import("./pages/Recurring").then((m) => m.Recurring)) },
  { path: "/grupos", element: page(() => import("./pages/Playlists").then((m) => m.Playlists)) },
  { path: "/grupos/:id", element: page(playlistDetail) },
  { path: "/playlists", element: <Navigate to="/grupos" replace /> },
  { path: "/ativos", element: page(() => import("./pages/Assets").then((m) => m.Assets)) },
  { path: "/ativos/:id", element: page(playlistDetail) },
  { path: "/lista-compras", element: page(() => import("./pages/ShoppingList").then((m) => m.ShoppingList)) },
  { path: "/patrimonio", element: page(() => import("./pages/NetWorthTable").then((m) => m.NetWorthTable)) },
  { path: "/emprestimos", element: page(() => import("./pages/Loans").then((m) => m.Loans)) },
  { path: "/metas", element: page(() => import("./pages/Goals").then((m) => m.Goals)) },
  { path: "/calculos", element: page(() => import("./pages/Sheets").then((m) => m.Sheets)) },
  { path: "/mercado", element: page(() => import("./pages/Market").then((m) => m.Market)) },
  { path: "/bot", element: page(() => import("./pages/BotPage").then((m) => m.BotPage)) },
])
