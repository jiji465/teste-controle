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
  const showAll = currentPeriod === "all"
  const currentDate = parsePeriod(showAll ? null : currentPeriod)

  const goTo = (date: Date) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("period", formatPeriod(date))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePrevMonth = () => goTo(subMonths(currentDate, 1))
  const handleNextMonth = () => goTo(addMonths(currentDate, 1))
  const handleReset = () => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.delete("period")
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }
  const handleShowAll = () => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("period", "all")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const todayPeriod = formatPeriod(new Date())
  const isCurrentMonth = !showAll && (!currentPeriod || currentPeriod === todayPeriod)
  const isPast = !showAll && currentPeriod !== null && currentPeriod < todayPeriod
  const isFuture = !showAll && currentPeriod !== null && currentPeriod > todayPeriod

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
                {!isMounted ? "Carregando..." : showAll ? "Todos os meses" : format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="center">
            <div className="grid grid-cols-3 gap-2">
              <p className="col-span-3 text-xs font-semibold text-muted-foreground uppercase mb-2">Últimos meses</p>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const date = subMonths(new Date(), i)
                const isActive = !showAll && formatPeriod(currentDate) === formatPeriod(date)
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
                variant={isCurrentMonth ? "secondary" : "ghost"}
                size="sm"
                className="col-span-3 text-xs mt-1"
                onClick={handleReset}
              >
                Voltar para o mês atual
              </Button>
              <Button
                variant={showAll ? "default" : "ghost"}
                size="sm"
                className="col-span-3 text-xs"
                onClick={handleShowAll}
              >
                Mostrar todos os meses
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {!isCurrentMonth && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs gap-1"
            onClick={handleReset}
            title="Voltar ao mês atual"
          >
            Hoje
          </Button>
          <div
            className={`hidden sm:flex items-center px-3 py-1 rounded-full text-[10px] font-bold border ${
              showAll
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900"
                : isPast
                  ? "bg-muted text-muted-foreground border-border"
                  : isFuture
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900"
                    : ""
            }`}
          >
            {showAll ? "SEM FILTRO" : isPast ? "PASSADO" : isFuture ? "PROJEÇÃO" : ""}
          </div>
        </>
      )}
    </div>
  )
}
