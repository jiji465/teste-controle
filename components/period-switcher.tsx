"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"

export function PeriodSwitcher() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-muted/50 rounded-lg p-1 border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
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
              {/* This could be expanded to a full year/month picker */}
              <p className="col-span-3 text-xs font-semibold text-muted-foreground uppercase mb-2">Selecione o Período</p>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const date = subMonths(new Date(), i)
                return (
                  <Button
                    key={i}
                    variant={format(currentDate, "MM-yy") === format(date, "MM-yy") ? "default" : "outline"}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => setCurrentDate(date)}
                  >
                    {format(date, "MMM", { locale: ptBR })}
                  </Button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      
      <div className="hidden sm:flex items-center px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold border border-primary/20">
        PROCESSO ATIVO
      </div>
    </div>
  )
}
