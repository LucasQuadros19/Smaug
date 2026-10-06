import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { shoppingItemsApi, type ShoppingItemInput } from "../api/shoppingItems"

export function useShoppingItems(playlistId?: number) {
  return useQuery({
    queryKey: ["shopping-items", playlistId ?? "standalone"],
    queryFn: () => shoppingItemsApi.list(playlistId),
  })
}

export function useShoppingItemMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shopping-items"] })
  }

  const create = useMutation({
    mutationFn: (data: ShoppingItemInput) => shoppingItemsApi.create(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ShoppingItemInput & { purchased: boolean }> }) =>
      shoppingItemsApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => shoppingItemsApi.remove(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
