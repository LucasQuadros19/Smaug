import { Suspense, lazy, type ComponentType, type ReactNode } from "react"
import { Navigate, createBrowserRouter } from "react-router-dom"
import { AppLayout } from "./components/layout/AppLayout"
import { Transactions } from "./pages/Transactions"
import { Accounts } from "./pages/Accounts"
import { Categories } from "./pages/Categories"
import { Budgets } from "./pages/Budgets"
import { Recurring } from "./pages/Recurring"
import { Playlists } from "./pages/Playlists"
import { Assets } from "./pages/Assets"
import { ShoppingList } from "./pages/ShoppingList"
import { NetWorthTable } from "./pages/NetWorthTable"
import { Loans } from "./pages/Loans"
import { Goals } from "./pages/Goals"

// O Dashboard carrega a biblioteca de gráficos (~400KB). Separando em outro
// chunk, quem abre direto em outra tela não paga por ela.
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard }))
)
const PlaylistDetail = lazy(() =>
  import("./pages/PlaylistDetail").then((m) => ({ default: m.PlaylistDetail }))
)

function Loading() {
  return <p className="p-6 text-sm text-slate-400">Carregando...</p>
}

function withLayout(children: ReactNode) {
  return <AppLayout>{children}</AppLayout>
}

function lazyRoute(Component: ComponentType) {
  return withLayout(
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: "/", element: lazyRoute(Dashboard) },
  { path: "/transacoes", element: withLayout(<Transactions />) },
  { path: "/contas", element: withLayout(<Accounts />) },
  { path: "/categorias", element: withLayout(<Categories />) },
  { path: "/orcamentos", element: withLayout(<Budgets />) },
  { path: "/recorrentes", element: withLayout(<Recurring />) },
  { path: "/grupos", element: withLayout(<Playlists />) },
  { path: "/grupos/:id", element: lazyRoute(PlaylistDetail) },
  // Endereço antigo, para favoritos que ainda apontam para cá.
  { path: "/playlists", element: <Navigate to="/grupos" replace /> },
  { path: "/ativos", element: withLayout(<Assets />) },
  { path: "/ativos/:id", element: lazyRoute(PlaylistDetail) },
  { path: "/lista-compras", element: withLayout(<ShoppingList />) },
  { path: "/patrimonio", element: withLayout(<NetWorthTable />) },
  { path: "/emprestimos", element: withLayout(<Loans />) },
  { path: "/metas", element: withLayout(<Goals />) },
])
