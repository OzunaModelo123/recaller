import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[5.5rem] w-full rounded-lg border border-input bg-card px-3 py-3 text-base shadow-[var(--shadow-xs)] transition-all duration-150 outline-none placeholder:text-muted-foreground hover:border-border focus:border-primary focus:shadow-[var(--shadow-input-focus)] focus:ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
