import { COMMON_ICONS } from "../../lib/constants"

export function IconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (icon: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COMMON_ICONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
            value === emoji
              ? "bg-indigo-600/10 ring-1 ring-indigo-500"
              : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
