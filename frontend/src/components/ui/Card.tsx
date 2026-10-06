import clsx from "clsx"
import type { HTMLAttributes } from "react"

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        "dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none",
        className
      )}
      {...props}
    />
  )
}
