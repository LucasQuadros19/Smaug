import { api } from "./client"
import type { Share, ShareSection } from "../types"

export const sharesApi = {
  list: () => api.get<Share[]>("/shares"),
  invite: (data: { user_id: string; sections: ShareSection[] }) => api.post<Share>("/shares", data),
  accept: (id: number, sections: ShareSection[]) => api.post<Share>(`/shares/${id}/accept`, { sections }),
  update: (id: number, sections: ShareSection[]) => api.put<Share>(`/shares/${id}`, { sections }),
  end: (id: number) => api.delete(`/shares/${id}`),
}
