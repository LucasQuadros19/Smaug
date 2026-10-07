import { useState, type FormEvent } from "react"
import { Flame } from "lucide-react"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Input, Label } from "../components/ui/Input"
import { useAuthActions } from "../hooks/useMe"

export function Login() {
  const { login, signup } = useAuthActions()
  const [creating, setCreating] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const action = creating ? signup : login
    action({ username, password })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false))
  }

  const switchMode = () => {
    setCreating(!creating)
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-[#0b0d14]">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-lg shadow-orange-500/30">
            <Flame size={18} />
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-white">Smaug</span>
        </div>

        <h1 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
          {creating ? "Criar conta" : "Entrar"}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              minLength={3}
              maxLength={30}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={creating ? 8 : undefined}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {creating && <p className="mt-1 text-xs text-slate-400">Pelo menos 8 caracteres.</p>}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {creating ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-4 w-full text-center text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {creating ? "Já tenho conta" : "Criar uma conta"}
        </button>
      </Card>
    </div>
  )
}
