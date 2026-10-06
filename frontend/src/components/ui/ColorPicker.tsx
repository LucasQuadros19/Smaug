import clsx from "clsx"
import { COLOR_PALETTE } from "../../lib/constants"

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={clsx(
            "h-7 w-7 rounded-full ring-offset-2 ring-offset-white transition-all dark:ring-offset-[#12141e]",
            value === color && "ring-2 ring-slate-900 dark:ring-white"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}
