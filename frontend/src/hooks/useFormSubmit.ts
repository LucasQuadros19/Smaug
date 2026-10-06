import { useState } from "react"

export function useFormSubmit(onSuccess: () => void) {
  const [error, setError] = useState<string | null>(null)

  const submit = (action: Promise<unknown>) => {
    setError(null)
    action.then(onSuccess).catch((err: Error) => setError(err.message))
  }

  const reset = () => setError(null)

  return { submit, error, reset }
}
