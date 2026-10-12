"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Pagination } from "@/hooks/use-pagination"
import { cn } from "@/lib/utils"

/** Rodapé de paginação das listas ("Mostrando 1–50 de 312"). Some com 1 página. */
export function ListPagination<T>({ pagination, className }: { pagination: Pagination<T>; className?: string }) {
  const { page, pageCount, total, from, to, setPage } = pagination
  if (pageCount <= 1) return null

  // Janela compacta de páginas: 1 … 4 5 6 … 12
  const pages: (number | "…")[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== "…") pages.push("…")
  }

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex flex-col items-center justify-between gap-2 pt-3 text-sm sm:flex-row", className)}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              size="sm"
              className="h-8 min-w-8 px-2 tabular-nums"
              onClick={() => setPage(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Página ${p}`}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}
