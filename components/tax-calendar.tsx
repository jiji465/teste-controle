"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, AlertCircle, Clock } from "lucide-react"
import type { Tax } from "@/lib/types"
import { formatDate, isOverdue } from "@/lib/date-utils"

type TaxCalendarProps = {
  taxes: Tax[]
}

export function TaxCalendar({ taxes }: TaxCalendarProps) {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  // Agrupar impostos por dia de vencimento
  const taxesByDay = taxes.reduce(
    (acc, tax) => {
      if (tax.dueDay) {
        if (!acc[tax.dueDay]) {
          acc[tax.dueDay] = []
        }
        acc[tax.dueDay].push(tax)
      }
      return acc
    },
    {} as Record<number, Tax[]>,
  )

  // Calcular próximos vencimentos
  const upcomingTaxes = Object.entries(taxesByDay)
    .map(([day, taxList]) => {
      const dueDate = new Date(currentYear, currentMonth, Number.parseInt(day))
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1)
      }
      return {
        day: Number.parseInt(day),
        date: dueDate,
        taxes: taxList,
        isOverdue: isOverdue(dueDate.toISOString()),
        daysUntil: Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      }
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10)

  const getUrgencyColor = (daysUntil: number, isOverdue: boolean) => {
    if (isOverdue) return "text-red-600 bg-red-50 dark:bg-red-950/30"
    if (daysUntil <= 3) return "text-orange-600 bg-orange-50 dark:bg-orange-950/30"
    if (daysUntil <= 7) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30"
    return "text-blue-600 bg-blue-50 dark:bg-blue-950/30"
  }

  const getUrgencyIcon = (daysUntil: number, isOverdue: boolean) => {
    if (isOverdue) return <AlertCircle className="size-4" />
    if (daysUntil <= 3) return <Clock className="size-4" />
    return <Calendar className="size-4" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-5" />
          Calendário de Vencimentos de Impostos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingTaxes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="size-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum imposto com vencimento definido</p>
            </div>
          ) : (
            upcomingTaxes.map((item, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getUrgencyColor(item.daysUntil, item.isOverdue)} transition-all hover-lift`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">{getUrgencyIcon(item.daysUntil, item.isOverdue)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{formatDate(item.date.toISOString())}</span>
                        <Badge variant="outline" className="text-xs">
                          Dia {item.day}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {item.taxes.map((tax) => (
                          <div key={tax.id} className="text-sm font-medium">
                            {tax.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {item.isOverdue ? "Atrasado" : item.daysUntil === 0 ? "Hoje" : `${item.daysUntil}d`}
                    </div>
                    <div className="text-xs opacity-75">
                      {item.taxes.length} {item.taxes.length === 1 ? "imposto" : "impostos"}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
