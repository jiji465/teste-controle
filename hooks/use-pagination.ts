"use client"

import { useState } from "react"

export const DEFAULT_PAGE_SIZE = 50

export type Pagination<T> = {
  items: T[]
  page: number
  pageCount: number
  total: number
  /** Índice (1-based) do primeiro item exibido */
  from: number
  /** Índice (1-based) do último item exibido */
  to: number
  setPage: (page: number) => void
}

/**
 * Paginação no cliente para listas grandes: renderizar centenas de linhas
 * de uma vez deixava as telas lentas. Volta para a página 1 sempre que o
 * total muda (novo filtro/busca).
 */
export function usePagination<T>(all: T[], pageSize = DEFAULT_PAGE_SIZE): Pagination<T> {
  const [state, setState] = useState({ page: 1, total: all.length })
  // "Estado derivado": filtro mudou o total → volta pra página 1 (sem effect)
  if (state.total !== all.length) setState({ page: 1, total: all.length })

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize))
  const page = Math.min(state.total !== all.length ? 1 : state.page, pageCount)
  const start = (page - 1) * pageSize
  return {
    items: all.slice(start, start + pageSize),
    page,
    pageCount,
    total: all.length,
    from: all.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, all.length),
    setPage: (p) => setState((s) => ({ ...s, page: Math.max(1, Math.min(p, pageCount)) })),
  }
}
