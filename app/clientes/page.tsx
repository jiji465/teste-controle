"use client"

import { Building2 } from "lucide-react"
import { ClientList } from "@/features/clients/components/client-list"
import { PageHeader } from "@/components/page-header"
import { ExportButton } from "@/components/export-button"
import { useData } from "@/contexts/data-context"
import { formatDocument } from "@/lib/cnpj-validation"
import { TAX_REGIME_LABELS, type Client } from "@/lib/types"
import type { ExportColumn } from "@/lib/export-utils"

const CLIENT_EXPORT_COLUMNS: ExportColumn<Client>[] = [
  { header: "Razão social", width: 36, accessor: (c) => c.name },
  { header: "Nome fantasia", width: 26, accessor: (c) => c.tradeName },
  { header: "CNPJ/CPF", width: 20, accessor: (c) => formatDocument(c.cnpj) },
  { header: "Regime", width: 18, accessor: (c) => (c.taxRegime ? TAX_REGIME_LABELS[c.taxRegime] : "") },
  { header: "Atividade", width: 14, accessor: (c) => c.businessActivity },
  { header: "CNAE", width: 12, accessor: (c) => c.cnaeCode },
  { header: "Inscrição estadual", width: 18, accessor: (c) => c.ie },
  { header: "Inscrição municipal", width: 18, accessor: (c) => c.im },
  { header: "Cidade", width: 18, accessor: (c) => c.city },
  { header: "UF", width: 5, accessor: (c) => c.state },
  { header: "E-mail", width: 28, accessor: (c) => c.email },
  { header: "Telefone", width: 16, accessor: (c) => c.phone },
  { header: "Situação", width: 10, accessor: (c) => (c.status === "active" ? "Ativa" : "Arquivada") },
]

export default function ClientesPage() {
  const { clients, refreshData } = useData()

  const handleUpdate = async () => {
    await refreshData()
  }

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            icon={Building2}
            title="Empresas"
            description="Gerencie as empresas, regimes tributários e informações cadastrais"
          />
          <ExportButton
            filenamePrefix="empresas"
            pdfTitle="Cadastro de empresas"
            sheetName="Empresas"
            columns={CLIENT_EXPORT_COLUMNS}
            rows={clients}
          />
        </div>

        <ClientList clients={clients} onUpdate={handleUpdate} />
      </div>
    </div>
  )
}
