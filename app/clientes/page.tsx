"use client"

import { useState } from "react"
import { Building2 } from "lucide-react"
import { ClientList } from "@/features/clients/components/client-list"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/contexts/data-context"

export default function ClientesPage() {
  const { clients, refreshData } = useData()

  const handleUpdate = async () => {
    await refreshData()
  }

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5">
      <div className="space-y-5">
        <PageHeader
          icon={Building2}
          title="Empresas"
          description="Gerencie as empresas, regimes tributários e informações cadastrais"
        />

        <ClientList clients={clients} onUpdate={handleUpdate} />
      </div>
    </div>
  )
}
