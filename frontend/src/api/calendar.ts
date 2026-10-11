import { api } from "./client"
import type { CalendarEvent, CalendarItem } from "../types"

export type CalendarEventInput = Omit<CalendarEvent, "id">

export const calendarApi = {
  month: (month: string) => api.get<{ month: string; items: CalendarItem[] }>("/calendar", { params: { month } }),
  create: (data: CalendarEventInput) => api.post<CalendarEvent>("/calendar/events", data),
  update: (id: number, data: Partial<CalendarEventInput>) => api.put<CalendarEvent>(`/calendar/events/${id}`, data),
  remove: (id: number) => api.delete(`/calendar/events/${id}`),
}
