import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base shadow-[var(--shadow-xs)] transition-all duration-150 outline-none placeholder:text-muted-foreground hover:border-border focus:border-primary focus:shadow-[var(--shadow-input-focus)] focus:ring-0 focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-base file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
