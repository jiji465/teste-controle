"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ClientList } from "@/features/clients/components/client-list"
import type { Client } from "@/lib/types"
import { useData } from "@/contexts/data-context"

export default function ClientesPage() {
  const { clients, refreshData } = useData()

  const handleUpdate = async () => {
    await refreshData()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie os clientes, regimes tributários e informações cadastrais
            </p>
          </div>

          <ClientList clients={clients} onUpdate={handleUpdate} />
        </div>
      </main>
    </div>
  )
}
