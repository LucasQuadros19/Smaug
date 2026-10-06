import clsx from "clsx"
import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes } from "react"

const fieldClasses = clsx(
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
  "outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-indigo-400"
)

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldClasses, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(fieldClasses, className)} {...props} />
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx(
        "mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400",
        className
      )}
      {...props}
    />
  )
}
