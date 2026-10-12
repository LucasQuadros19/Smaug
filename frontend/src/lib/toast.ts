import { useSyncExternalStore } from "react"

/** Avisos curtos no canto da tela: "Transação excluída", ou o erro de uma ação que não tem janela própria. */
export type Toast = { id: number; message: string; tone: "success" | "error" }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export function toast(message: string, tone: Toast["tone"] = "success") {
  const item = { id: nextId++, message, tone }
  toasts = [...toasts, item]
  emit()
  // Erro fica mais tempo: dá para ler o motivo.
  setTimeout(() => dismiss(item.id), tone === "error" ? 7000 : 3500)
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** Para `onError` de ações sem janela: mostra o motivo que o servidor deu. */
export const toastError = (error: Error) => toast(error.message, "error")

export function useToasts() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => toasts
  )
}
