"use client"

/**
 * Página /servicos — 4º tipo de tarefa do app.
 *
 * Lista de serviços avulsos prestados aos clientes (NF-e, consultoria,
 * outros). Mesmo padrão visual de /obrigacoes: cabeçalho fino, tabs por
 * status, e ServiceList cuidando de busca + filtros pill + ordenação +
 * bulk actions (concluir, em andamento, reabrir, editar, excluir).
 */

import { useMemo, useRef, useState } from "react"
import { useUrlState } from "@/hooks/use-url-state"
import { ServiceList, type ServiceListHandle } from "@/features/services/components/service-list"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import {
  Briefcase,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Plus,
  CalendarDays,
} from "lucide-react"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { isOverdue } from "@/lib/date-utils"
import type { Service } from "@/lib/types"

function effectiveServiceStatus(s: Service): Service["status"] {
  if (s.status === "completed") return "completed"
  if (s.status === "in_progress") return "in_progress"
  return isOverdue(s.dueDate) ? "overdue" : "pending"
}

export default function ServicosPage() {
  const { services: rawServices, clients, refreshData } = useData()
  const [activeTab, setActiveTab] = useUrlState("tab")
  const listRef = useRef<ServiceListHandle>(null)
  const { isInPeriod, periodLabel, isFiltering } = useSelectedPeriod()

  const services = useMemo(
    () => rawServices.filter((s) => isInPeriod(s.dueDate)),
    [rawServices, isInPeriod],
  )

  const updateData = async () => {
    await refreshData()
  }

  const pendingServices = services.filter((s) => effectiveServiceStatus(s) === "pending")
  const inProgressServices = services.filter((s) => s.status === "in_progress")
  const completedServices = services.filter((s) => s.status === "completed")
  const overdueServices = services.filter((s) => effectiveServiceStatus(s) === "overdue")

  const getFilteredServices = () => {
    switch (activeTab) {
      case "pending":
        return pendingServices
      case "in_progress":
        return inProgressServices
      case "completed":
        return completedServices
      case "overdue":
        return overdueServices
      default:
        return services
    }
  }

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            icon={Briefcase}
            title="Serviços Avulsos"
            description="NF-e, consultoria e outros serviços prestados aos clientes"
            badge={
              isFiltering && periodLabel ? (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <CalendarDays className="size-3" />
                  {periodLabel}
                </Badge>
              ) : null
            }
          />
          <div className="flex gap-2">
            <Button onClick={() => listRef.current?.openNewForm()}>
              <Plus className="size-4 mr-2" />
              Novo Serviço
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto h-auto [&>button]:shrink-0 sm:grid sm:grid-cols-5">
            <TabsTrigger value="all" className="flex flex-col gap-1 py-3">
              <span className="text-sm font-medium">Todos</span>
              <Badge variant="secondary" className="text-xs">
                {services.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {pendingServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <PlayCircle className="size-3.5" />
                <span className="text-sm font-medium">Em Andamento</span>
              </div>
              <Badge
                variant="secondary"
                className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              >
                {inProgressServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span className="text-sm font-medium">Concluídos</span>
              </div>
              <Badge
                variant="secondary"
                className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              >
                {completedServices.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                <span className="text-sm font-medium">Atrasados</span>
              </div>
              <Badge
                variant="secondary"
                className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {overdueServices.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-6">
          <ServiceList
            ref={listRef}
            services={getFilteredServices()}
            clients={clients}
            onUpdate={updateData}
          />
        </div>
      </div>
    </div>
  )
}
