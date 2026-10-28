import { useQuery } from "@tanstack/react-query"
import { backupApi } from "../api/backup"
import { ApiError } from "../api/client"

export const BACKUP_KEY = ["backup"]

/** null para quem não criou a primeira conta: a aba Backup nem aparece. */
export function useBackupConfig() {
  return useQuery({
    queryKey: BACKUP_KEY,
    queryFn: () =>
      backupApi.get().catch((error) => {
        if (error instanceof ApiError && error.status === 403) return null
        throw error
      }),
    retry: false,
    // Enquanto o pedido de envio espera o servidor, a tela confere sozinha.
    refetchInterval: (q) => (q.state.data?.envio_pedido_em ? 10_000 : false),
  })
}
