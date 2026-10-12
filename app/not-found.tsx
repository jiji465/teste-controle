import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Página não encontrada</h2>
        <p className="mt-1 text-sm text-muted-foreground">O endereço acessado não existe no sistema.</p>
      </div>
      <Button asChild>
        <Link href="/">Voltar ao Dashboard</Link>
      </Button>
    </div>
  )
}
