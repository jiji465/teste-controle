/**
 * Skeleton genérico de página com cabeçalho, abas, busca e tabela.
 * Reutilizado pelos `loading.tsx` de obrigações, impostos e parcelamentos.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* nav placeholder */}
      <div className="h-16 border-b bg-background/80" />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6 animate-pulse">
          {/* header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-9 w-72 bg-muted rounded" />
              <div className="h-5 w-96 bg-muted/60 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-28 bg-muted/60 rounded" />
              <div className="h-9 w-36 bg-muted rounded" />
            </div>
          </div>

          {/* tabs */}
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/60 rounded-md" />
            ))}
          </div>

          {/* toolbar */}
          <div className="flex gap-3">
            <div className="h-10 flex-1 bg-muted/40 rounded" />
            <div className="h-10 w-24 bg-muted/60 rounded" />
          </div>

          {/* table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="h-12 bg-muted/40 border-b" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 border-b last:border-b-0 px-4 flex items-center gap-3">
                <div className="size-4 bg-muted/60 rounded" />
                <div className="h-4 w-1/4 bg-muted/60 rounded" />
                <div className="h-4 w-1/5 bg-muted/40 rounded" />
                <div className="h-4 w-1/6 bg-muted/40 rounded" />
                <div className="h-4 w-1/6 bg-muted/40 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
