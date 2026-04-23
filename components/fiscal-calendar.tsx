"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  FileText
} from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"

type FiscalCalendarProps = {
  obligations: ObligationWithDetails[]
}

export function FiscalCalendar({ obligations }: FiscalCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days = []
    // Add empty slots for days before the first day of the month
    const firstDayOfWeek = firstDay.getDay()
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }, [currentDate])

  const obligationsByDay = useMemo(() => {
    const map: Record<string, ObligationWithDetails[]> = {}
    
    obligations.forEach(obl => {
      const date = new Date(obl.calculatedDueDate)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(obl)
    })
    
    return map
  }, [obligations])

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' })
  const year = currentDate.getFullYear()

  return (
    <Card className="glass-card overflow-hidden border-none shadow-xl">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl capitalize">{monthName} {year}</CardTitle>
              <CardDescription>Agenda Fiscal e Vencimentos</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-full bg-background/50">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-full bg-background/50">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Weekdays Header */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/50">
          {daysInMonth.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-muted/10 min-h-[120px]" />
            
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
            const dayObs = obligationsByDay[key] || []
            const isToday = new Date().toDateString() === day.toDateString()
            
            return (
              <div 
                key={key} 
                className={`min-h-[120px] p-2 transition-colors hover:bg-primary/5 group ${isToday ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`
                    text-sm font-bold size-7 flex items-center justify-center rounded-full transition-all
                    ${isToday ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : 'text-muted-foreground group-hover:text-primary'}
                  `}>
                    {day.getDate()}
                  </span>
                  {dayObs.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 bg-muted/50">
                      {dayObs.length}
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-1">
                  {dayObs.slice(0, 3).map(obl => (
                    <div 
                      key={obl.id} 
                      className={`
                        text-[9px] p-1 rounded border flex items-center gap-1 truncate transition-all
                        ${obl.status === 'completed' 
                          ? 'bg-green-50/50 text-green-700 border-green-100 opacity-70' 
                          : 'bg-primary/5 text-primary border-primary/10 hover:border-primary/30'}
                      `}
                    >
                      {obl.category === 'tax_guide' ? <Receipt className="size-2 shrink-0" /> : <FileText className="size-2 shrink-0" />}
                      <span className="truncate font-medium">{obl.name}</span>
                    </div>
                  ))}
                  {dayObs.length > 3 && (
                    <div className="text-[9px] text-center text-muted-foreground font-medium py-0.5">
                      + {dayObs.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
