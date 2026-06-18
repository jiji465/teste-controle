"use client"

import { useRef, useState, type ReactNode } from "react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type ResizableTableHeadProps = {
  /** Largura inicial da coluna em px. */
  defaultWidth: number
  /** Largura mínima ao arrastar (px). */
  minWidth?: number
  /** @deprecated não usado — mantido só pra compatibilidade de assinatura. */
  maxWidth?: number
  /** @deprecated não usado — antes persistia no localStorage (causava trava permanente). */
  storageKey?: string
  className?: string
  children: ReactNode
}

/**
 * Cabeçalho de coluna REDIMENSIONÁVEL (arrastar a borda, tipo Excel).
 *
 * Histórico: o resize já existiu, foi removido por 2 problemas, e agora voltou
 * CORRIGINDO os dois:
 *   1. Largura "travada pra sempre" → agora a largura é estado de React (reseta
 *      ao recarregar a página); NÃO persiste em localStorage.
 *   2. Reset → 2 cliques (double-click) na alça voltam a coluna pro tamanho
 *      padrão.
 *   3. Atrapalhar a rolagem → a alça é uma faixa fina na borda direita, com
 *      cursor próprio; arrastar nela redimensiona, e o clique não dispara a
 *      ordenação do cabeçalho.
 *
 * Requer `table-fixed` na <Table> pra a largura ser respeitada e o texto longo
 * ser truncado (sem sobrepor a coluna vizinha).
 */
export function ResizableTableHead({
  defaultWidth,
  minWidth = 64,
  className,
  children,
}: ResizableTableHeadProps) {
  const [width, setWidth] = useState(defaultWidth)
  const drag = useRef<{ startX: number; startW: number } | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { startX: e.clientX, startW: width }

    const onMove = (ev: MouseEvent) => {
      if (!drag.current) return
      const next = Math.max(minWidth, drag.current.startW + (ev.clientX - drag.current.startX))
      setWidth(next)
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <TableHead
      className={cn("relative", className)}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        title="Arraste para redimensionar · 2 cliques para resetar"
        onMouseDown={handleMouseDown}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setWidth(defaultWidth)
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none hover:bg-primary/40"
      />
    </TableHead>
  )
}
