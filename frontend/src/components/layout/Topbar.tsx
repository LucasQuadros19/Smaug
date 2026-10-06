import type { ReactNode } from "react"
import { MenuButton } from "./AppLayout"
import { ThemeToggle } from "./ThemeToggle"

export function Topbar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 dark:border-white/10 dark:bg-[#0b0d14]/80">
      <MenuButton />
      <h1 className="flex-1 truncate text-lg font-semibold text-slate-900 sm:text-xl dark:text-white">
        {title}
      </h1>
      {/* No celular as ações descem para uma linha própria e quebram se precisar. */}
      {action && (
        <div className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto [&>*]:flex-wrap">
          {action}
        </div>
      )}
      <ThemeToggle />
    </header>
  )
}
