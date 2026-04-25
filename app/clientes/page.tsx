"use client"

import { useState } from "react"
import { ClientList } from "@/features/clients/components/client-list"
import { useData } from "@/contexts/data-context"

export default function ClientesPage() {
  const { clients, refreshData } = useData()

  const handleUpdate = async () => {
    await refreshData()
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6 py-5">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as empresas, regimes tributários e informações cadastrais
          </p>
        </div>

        <ClientList clients={clients} onUpdate={handleUpdate} />
      </div>
    </div>
  )
}
