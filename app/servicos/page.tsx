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
import { StatFilterBar } from "@/components/stat-filter-bar"
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

        {/* Cartões de status = resumo + filtro (estilo Dashboard). */}
        <StatFilterBar
          value={activeTab || "all"}
          onChange={setActiveTab}
          items={[
            { value: "all", label: "Todos", count: services.length, icon: Briefcase, tone: "neutral" },
            { value: "pending", label: "Pendentes", count: pendingServices.length, icon: Clock, tone: "warning" },
            { value: "in_progress", label: "Em Andamento", count: inProgressServices.length, icon: PlayCircle, tone: "info" },
            { value: "completed", label: "Concluídos", count: completedServices.length, icon: CheckCircle2, tone: "success" },
            { value: "overdue", label: "Atrasados", count: overdueServices.length, icon: AlertTriangle, tone: "danger" },
          ]}
        />

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
