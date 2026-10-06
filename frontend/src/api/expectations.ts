import { api } from "./client"
import type { PlaylistExpectation } from "../types"

export type ExpectationInput = {
  playlist_id: number
  description: string
  amount: number
  expected_date: string
  account_id?: number | null
}

export type LaunchExpectationInput = {
  account_id: number
  amount?: number
  date?: string
  category_id?: number | null
  notes?: string | null
}

export const expectationsApi = {
  list: (filters: { playlist_id?: number; status?: string } = {}) =>
    api.get<PlaylistExpectation[]>("/expectations", { params: filters }),
  create: (data: ExpectationInput) =>
    api.post<PlaylistExpectation>("/expectations", data),
  update: (id: number, data: Partial<ExpectationInput>) =>
    api.put<PlaylistExpectation>(`/expectations/${id}`, data),
  remove: (id: number) => api.delete(`/expectations/${id}`),
  launch: (id: number, data: LaunchExpectationInput) =>
    api
      .post<{ expectation: PlaylistExpectation }>(`/expectations/${id}/launch`, data),
}
