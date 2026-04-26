"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type ResizableTableHeadProps = {
  /** Largura inicial em px */
  defaultWidth: number
  /** Largura mínima permitida ao arrastar (default: 80px) */
  minWidth?: number
  /** Largura máxima permitida ao arrastar (default: 800px) */
  maxWidth?: number
  /** Chave única para persistir a largura no localStorage (opcional) */
  storageKey?: string
  className?: string
  children: ReactNode
}

/**
 * `<TableHead>` com handle de resize no canto direito.
 * Arrasta a borda direita pra ajustar a largura. Lembra entre sessões
 * via localStorage se `storageKey` for passada.
 */
export function ResizableTableHead({
  defaultWidth,
  minWidth = 80,
  maxWidth = 800,
  storageKey,
  className,
  children,
}: ResizableTableHeadProps) {
  const [width, setWidth] = useState<number>(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(`col-width-${storageKey}`)
      if (stored) {
        const n = Number(stored)
        if (!Number.isNaN(n) && n >= minWidth && n <= maxWidth) return n
      }
    }
    return defaultWidth
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return
    localStorage.setItem(`col-width-${storageKey}`, String(width))
  }, [width, storageKey])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      const next = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <TableHead
      className={cn("relative group", className)}
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
    >
      {children}
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none opacity-0 group-hover:opacity-100 hover:bg-primary/40 transition-colors"
        title="Arraste para ajustar largura"
        aria-hidden
      />
    </TableHead>
  )
}
