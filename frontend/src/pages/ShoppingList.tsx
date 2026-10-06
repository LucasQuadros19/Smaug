import { Topbar } from "../components/layout/Topbar"
import { ShoppingListSection } from "../components/shopping/ShoppingListSection"

export function ShoppingList() {
  return (
    <>
      <Topbar title="Lista de compras" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ShoppingListSection title="Coisas para comprar" />
      </main>
    </>
  )
}
