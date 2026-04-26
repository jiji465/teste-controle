"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addMonths, subMonths, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useSelectedPeriod } from "@/contexts/period-context"

const formatPeriod = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const parsePeriod = (period: string | null): Date => {
  if (!period || period === "all") return new Date()
  try {
    return parse(period, "yyyy-MM", new Date())
  } catch {
    return new Date()
  }
}

export function PeriodSwitcher() {
  const { period, setPeriod, resetToCurrent, showAllPeriods, showAll, isCurrentMonth } =
    useSelectedPeriod()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const currentDate = parsePeriod(showAll ? null : period)
  const todayPeriod = formatPeriod(new Date())
  const isPast = !showAll && period < todayPeriod
  const isFuture = !showAll && period > todayPeriod

  const handlePrevMonth = () => setPeriod(formatPeriod(subMonths(currentDate, 1)))
  const handleNextMonth = () => setPeriod(formatPeriod(addMonths(currentDate, 1)))

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
                {!isMounted
                  ? "Carregando..."
                  : showAll
                    ? "Todos os meses"
                    : format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="center">
            <div className="grid grid-cols-3 gap-2">
              <p className="col-span-3 text-xs font-semibold text-muted-foreground uppercase mb-2">
                Últimos meses
              </p>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const date = subMonths(new Date(), i)
                const isActive = !showAll && period === formatPeriod(date)
                return (
                  <Button
                    key={i}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => setPeriod(formatPeriod(date))}
                  >
                    {format(date, "MMM", { locale: ptBR })}
                  </Button>
                )
              })}
              <Button
                variant={isCurrentMonth ? "secondary" : "ghost"}
                size="sm"
                className="col-span-3 text-xs mt-1"
                onClick={resetToCurrent}
              >
                Voltar para o mês atual
              </Button>
              <Button
                variant={showAll ? "default" : "ghost"}
                size="sm"
                className="col-span-3 text-xs"
                onClick={showAllPeriods}
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
      )}
    </div>
  )
}
