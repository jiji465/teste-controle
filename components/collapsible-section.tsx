"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type CollapsibleSectionProps = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  storageKey?: string
  children: ReactNode
}

const STORAGE_PREFIX = "dashboard-section-"

export function CollapsibleSection({
  title,
  description,
  icon,
  badge,
  defaultOpen = false,
  storageKey,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => {
    if (!storageKey || typeof window === "undefined") return defaultOpen
    const stored = localStorage.getItem(STORAGE_PREFIX + storageKey)
    return stored === null ? defaultOpen : stored === "true"
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_PREFIX + storageKey, String(next))
    }
  }

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        aria-expanded={open}
      >
        {icon && <div className="shrink-0 text-muted-foreground">{icon}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{title}</h3>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t p-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
