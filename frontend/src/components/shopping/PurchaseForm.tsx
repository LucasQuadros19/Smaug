import { useState } from "react"
import { Button } from "../ui/Button"
import { Input, Label, Select } from "../ui/Input"
import { useAccounts } from "../../hooks/useAccounts"
import { useCategories } from "../../hooks/useCategories"
import { todayISO } from "../../lib/format"
import type { ShoppingItem } from "../../types"
import type { PurchaseLaunch } from "../../api/shoppingItems"

/** "Comprei": marca na lista e, se quiser, já lança o gasto no caixa. */
export function PurchaseForm({
  item,
  onSubmit,
  onCancel,
  submitting,
}: {
  item: ShoppingItem
  onSubmit: (launch: PurchaseLaunch | null) => void
  onCancel: () => void
  submitting: boolean
}) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories("expense")
  const [accountId, setAccountId] = useState(0)
  const [amount, setAmount] = useState(item.amount != null ? String(item.amount) : "")
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState(0)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(
          accountId
            ? { account_id: accountId, amount: Number(amount), date, category_id: categoryId || null }
            : null
        )
      }}
      className="space-y-4"
    >
      <div>
        <Label>Pagou com</Label>
        <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
          <option value={0}>Só marcar como comprado (não lançar)</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      {accountId > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quanto pagou</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Categoria (opcional)</Label>
            <Select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              <option value={0}>Sem categoria</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-slate-400">
            Vira um gasto na conta{item.playlist_id ? ", marcado com este grupo/ativo" : ""}. Desmarcar o item tira o gasto do caixa.
          </p>
        </>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {accountId ? "Comprei e lançar" : "Marcar como comprado"}
        </Button>
      </div>
    </form>
  )
}
