import { api, ApiError } from "./client"
import type { User } from "../types"

export type Credentials = { username: string; password: string }

export const authApi = {
  /** null quando ninguém está logado. */
  me: () =>
    api.get<User>("/auth/me").catch((error) => {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }),
  login: (data: Credentials) => api.post<User>("/auth/login", data),
  signup: (data: Credentials) => api.post<User>("/auth/signup", data),
  logout: () => api.post<void>("/auth/logout"),
  changePassword: (current: string, next: string) => api.post<void>("/auth/password", { current, new: next }),
  updateHiddenTabs: (hidden_tabs: string[]) => api.put<User>("/auth/me", { hidden_tabs }),
}
