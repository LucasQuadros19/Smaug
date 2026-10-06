type Params = Record<string, string | number | boolean | null | undefined>

async function request<T>(method: string, url: string, body?: unknown, params?: Params): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null) query.append(key, String(value))
  }
  const qs = query.toString()

  // Escrita sempre em JSON: o backend recusa outro formato (proteção contra CSRF).
  const response = await fetch(`/api${url}${qs ? `?${qs}` : ""}`, {
    method,
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
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
    throw new Error(message || (response.status >= 500 ? "Servidor indisponível ou com erro" : `Erro ${response.status}`))
  }
  return data as T
}

export const api = {
  get: <T>(url: string, options?: { params?: Params }) => request<T>("GET", url, undefined, options?.params),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: <T = void>(url: string) => request<T>("DELETE", url),
}
