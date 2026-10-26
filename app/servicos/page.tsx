"use client"

/**
 * Página /servicos — 4º tipo de tarefa do app.
 *
 * Lista de serviços avulsos prestados aos clientes (NF-e, consultoria,
 * outros). Mesmo padrão visual de /obrigacoes: cabeçalho fino, tabs por
 * status, e ServiceList cuidando de busca + filtros pill + ordenação +
 * bulk actions (concluir, em andamento, reabrir, editar, excluir).
 */

import { useMemo, useRef } from "react"
import { useUrlState } from "@/hooks/use-url-state"
import { ServiceList, type ServiceListHandle } from "@/features/services/components/service-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import {
  Briefcase,
  AlertTriangle,
  Plus,
  CalendarDays,
} from "lucide-react"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/hooks/use-selected-period"
import { parseLocalDate } from "@/lib/date-utils"
import { hasSupabaseConfig } from "@/lib/supabase/core"
import { filterByStatusTab, statusBucket } from "@/lib/obligation-status"
import { SERVICE_CATEGORY_LABELS, type Service } from "@/lib/types"
import { ExportButton } from "@/components/export-button"
import type { ExportColumn } from "@/lib/export-utils"

const STATUS_EXPORT_LABEL: Record<Service["status"], string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
  overdue: "Atrasado",
}

/** Mesma regra de effectiveStatus: pendente ou em andamento vencido = atrasado. */
function effectiveServiceStatus(s: Service): Service["status"] {
  return statusBucket({ status: s.status, calculatedDueDate: s.dueDate })
}

export default function ServicosPage() {
  const { services: rawServices, clients, refreshData } = useData()
  const [activeTab, setActiveTab] = useUrlState("tab")
  const listRef = useRef<ServiceListHandle>(null)
  const { isInPeriodOrOverdue, periodLabel, isFiltering } = useSelectedPeriod()
  // Serviços só existem com banco (não há armazenamento local para eles)
  const dbAvailable = hasSupabaseConfig()

  // Período do topo; no mês atual, atrasados de meses anteriores continuam aqui
  const services = useMemo(
    () => rawServices.filter((s) => isInPeriodOrOverdue(s.dueDate, s.status)),
    [rawServices, isInPeriodOrOverdue],
  )

  const updateData = async () => {
    await refreshData()
  }

  const getFilteredServices = () =>
    filterByStatusTab(services.map((x) => ({ ...x, calculatedDueDate: x.dueDate })), activeTab)

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? ""
  const serviceExportColumns: ExportColumn<Service>[] = [
    { header: "Serviço", width: 32, accessor: (s) => s.name },
    { header: "Empresa", width: 32, accessor: (s) => clientName(s.clientId) },
    { header: "Categoria", width: 16, accessor: (s) => SERVICE_CATEGORY_LABELS[s.category] },
    { header: "Vencimento", width: 12, accessor: (s) => parseLocalDate(s.dueDate) },
    { header: "Status", width: 14, accessor: (s) => STATUS_EXPORT_LABEL[effectiveServiceStatus(s)] },
    { header: "Concluído em", width: 14, accessor: (s) => (s.completedAt ? new Date(s.completedAt) : "") },
    { header: "Concluído por", width: 18, accessor: (s) => s.completedBy },
    { header: "Observações", width: 40, accessor: (s) => s.notes },
  ]

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
            <ExportButton
              filenamePrefix="servicos"
              pdfTitle="Serviços avulsos"
              pdfSubtitle={isFiltering && periodLabel ? `Período: ${periodLabel}` : undefined}
              sheetName="Serviços"
              columns={serviceExportColumns}
              rows={getFilteredServices()}
            />
            <Button
              onClick={() => listRef.current?.openNewForm()}
              disabled={!dbAvailable}
              title={dbAvailable ? undefined : "Serviços exigem o banco de dados (Supabase) configurado"}
            >
              <Plus className="size-4 mr-2" />
              Novo Serviço
            </Button>
          </div>
        </div>

        {!dbAvailable && (
          <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Serviços exigem o banco de dados</p>
              <p className="text-xs">
                O app está em modo local (sem Supabase configurado). Obrigações, guias e parcelamentos funcionam
                no navegador, mas Serviços só podem ser cadastrados com o banco conectado.
              </p>
            </div>
          </div>
        )}

        {/* Cartões de status (resumo + filtro) ficam dentro da lista: contam
            a lista já filtrada por busca/cliente/categoria/prioridade. */}
        <div className="mt-6">
          <ServiceList
            ref={listRef}
            services={services}
            clients={clients}
            onUpdate={updateData}
            activeTab={activeTab || "all"}
            onTabChange={setActiveTab}
          />
        </div>
      </div>
    </div>
  )
}
