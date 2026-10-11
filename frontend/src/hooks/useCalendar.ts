import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { calendarApi, type CalendarEventInput } from "../api/calendar"

export function useCalendar(month: string) {
  // Junta dados de várias telas: busca de novo sempre que a tela abre.
  return useQuery({
    queryKey: ["calendar", month],
    queryFn: () => calendarApi.month(month),
    staleTime: 0,
    placeholderData: (previous) => previous,
  })
}

export function useCalendarMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["calendar"] })

  const create = useMutation({ mutationFn: (data: CalendarEventInput) => calendarApi.create(data), onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CalendarEventInput> }) => calendarApi.update(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: number) => calendarApi.remove(id), onSuccess: invalidate })

  return { create, update, remove }
}
