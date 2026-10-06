type Params = Record<string, string | number | boolean | null | undefined>

async function request<T>(method: string, url: string, body?: unknown, params?: Params): Promise<T> {
  const query = new URLSearchParams()
  // Igual ao axios: null/undefined não vão para a URL.
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value != null) query.append(key, String(value))
  }
  const qs = query.toString()

  const response = await fetch(`/api${url}${qs ? `?${qs}` : ""}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : undefined
  if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`)
  return data as T
}

// O Vite repassa /api para o Flask (veja vite.config.ts).
export const api = {
  get: <T>(url: string, options?: { params?: Params }) => request<T>("GET", url, undefined, options?.params),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: <T = void>(url: string) => request<T>("DELETE", url),
}
