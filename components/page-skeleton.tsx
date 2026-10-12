/**
 * Skeleton genérico de página (cabeçalho, cartões de status e tabela), no
 * mesmo espaçamento das páginas internas — roda DENTRO da shell, então não
 * desenha header próprio. Usado pelos `loading.tsx` e pelos imports dinâmicos.
 */
export function PageSkeleton() {
  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5" role="status" aria-label="Carregando">
      <div className="space-y-5 animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="size-9 rounded-md bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-56 rounded bg-muted" />
              <div className="h-4 w-80 max-w-[60vw] rounded bg-muted/60" />
            </div>
          </div>
          <div className="hidden gap-2 sm:flex">
            <div className="h-9 w-28 rounded bg-muted/60" />
            <div className="h-9 w-36 rounded bg-muted" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[74px] rounded-xl bg-muted/60" />
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="h-11 border-b bg-muted/40" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex h-12 items-center gap-3 border-b px-4 last:border-b-0">
              <div className="size-4 rounded bg-muted/60" />
              <div className="h-4 w-1/4 rounded bg-muted/60" />
              <div className="h-4 w-1/5 rounded bg-muted/40" />
              <div className="ml-auto h-4 w-1/6 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
