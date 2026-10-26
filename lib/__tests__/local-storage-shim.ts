/** localStorage/window mínimos para testar o modo local (sem Supabase) no Node. */
export function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>()
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
  const g = globalThis as unknown as { window: unknown; localStorage: unknown }
  g.window = globalThis
  g.localStorage = ls
  return store
}
