"use client"

import { useCallback, useState } from "react"
import { allVisibleSelected, toggleAllVisible } from "@/lib/selection"

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Seleção em massa de uma lista. A seleção é LIMPA sempre que `resetKey`
 * muda (aba, filtros, período, busca, página) — ações em lote nunca atingem
 * itens que saíram da tela. "Selecionar todos" marca só os itens visíveis.
 */
export function useListSelection(resetKey: string) {
  const [state, setState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: resetKey, ids: EMPTY })
  // Estado derivado (sem effect): mudou o contexto da lista → zera a seleção
  if (state.key !== resetKey) setState({ key: resetKey, ids: EMPTY })
  const selectedIds = state.key === resetKey ? state.ids : EMPTY

  const toggle = useCallback((id: string) => {
    setState((s) => {
      const next = new Set(s.ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...s, ids: next }
    })
  }, [])

  const clear = useCallback(() => setState((s) => ({ ...s, ids: EMPTY })), [])

  const setAllVisible = useCallback((visibleIds: string[], checked: boolean) => {
    setState((s) => ({ ...s, ids: toggleAllVisible(s.ids, visibleIds, checked) }))
  }, [])

  return {
    selectedIds,
    toggle,
    clear,
    setAllVisible,
    isAllVisibleSelected: (visibleIds: string[]) => allVisibleSelected(selectedIds, visibleIds),
  }
}
