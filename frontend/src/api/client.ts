import { getViewing } from "../lib/viewing"

type Params = Record<string, string | number | boolean | null | undefined>

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, url: string, body?: unknown, params?: Params): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null) query.append(key, String(value))
  }
  const qs = query.toString()

  const headers: Record<string, string> = {}
  // Escrita sempre em JSON: o backend recusa outro formato (proteção contra CSRF).
  if (method !== "GET") headers["Content-Type"] = "application/json"
  // Vendo os dados de quem compartilhou: o backend confere se pode.
  const viewing = getViewing()
  if (viewing) headers["X-Owner"] = viewing.id

  const response = await fetch(`/api${url}${qs ? `?${qs}` : ""}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  })

  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }
  if (!response.ok) {
    const message = (data as { error?: string } | undefined)?.error
    throw new ApiError(
      message || (response.status >= 500 ? "Servidor indisponível ou com erro" : `Erro ${response.status}`),
      response.status
    )
  }
  return data as T
}

export const api = {
  get: <T>(url: string, options?: { params?: Params }) => request<T>("GET", url, undefined, options?.params),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: <T = void>(url: string) => request<T>("DELETE", url),
}
