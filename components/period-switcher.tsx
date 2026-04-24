"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addMonths, subMonths, parse } from "date-fns"
import { ptBR } from "date-fns/locale"

const formatPeriod = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const parsePeriod = (period: string | null): Date => {
  if (!period) return new Date()
  try {
    return parse(period, "yyyy-MM", new Date())
  } catch {
    return new Date()
  }
}

export function PeriodSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const currentPeriod = searchParams.get("period")
  const currentDate = parsePeriod(currentPeriod)

  const goTo = (date: Date) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("period", formatPeriod(date))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePrevMonth = () => goTo(subMonths(currentDate, 1))
  const handleNextMonth = () => goTo(addMonths(currentDate, 1))
  const handleReset = () => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.delete("period")
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  const isCurrentMonth =
    !currentPeriod || currentPeriod === formatPeriod(new Date())

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-muted/50 rounded-lg p-1 border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth} aria-label="Mês anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-3 font-medium">
              <CalendarDays className="size-4 text-primary" />
              <span className="capitalize">
                {isMounted ? format(currentDate, "MMMM yyyy", { locale: ptBR }) : "Carregando..."}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="center">
            <div className="grid grid-cols-3 gap-2">
              <p className="col-span-3 text-xs font-semibold text-muted-foreground uppercase mb-2">Últimos meses</p>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const date = subMonths(new Date(), i)
                const isActive = formatPeriod(currentDate) === formatPeriod(date)
                return (
                  <Button
                    key={i}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => goTo(date)}
                  >
                    {format(date, "MMM", { locale: ptBR })}
                  </Button>
                )
              })}
              <Button
                variant="ghost"
                size="sm"
                className="col-span-3 text-xs mt-1"
                onClick={handleReset}
              >
                Voltar para o mês atual
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {!isCurrentMonth && (
        <div className="hidden sm:flex items-center px-3 py-1 rounded-full text-xs font-bold border bg-muted text-muted-foreground border-border">
          CONSULTANDO PASSADO
        </div>
      )}
    </div>
  )
}
