/**
 * Seleção em massa das listas. "Selecionar todos" marca só os itens VISÍVEIS
 * (página e filtros atuais) — antes marcava a lista inteira, inclusive o que
 * estava em outras páginas, e uma ação em lote atingia itens que o usuário
 * nem via.
 */
export function toggleAllVisible(current: ReadonlySet<string>, visibleIds: string[], checked: boolean): Set<string> {
  const next = new Set(current)
  for (const id of visibleIds) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

export function allVisibleSelected(current: ReadonlySet<string>, visibleIds: string[]): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => current.has(id))
}
