"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { Client, Tax, Obligation, Installment } from "@/lib/types"
import { getClients, getTaxes, getObligations, getInstallments } from "@/lib/supabase/database"

interface DataContextType {
  clients: Client[]
  taxes: Tax[]
  obligations: Obligation[]
  installments: Installment[]
  isLoading: boolean
  refreshData: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  const refreshData = async () => {
    setIsLoading(true)
    try {
      const [cls, txs, obs, insts] = await Promise.all([
        getClients(),
        getTaxes(),
        getObligations(),
        getInstallments(),
      ])
      setClients(cls)
      setTaxes(txs)
      setObligations(obs)
      setInstallments(insts)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setIsMounted(true)
    refreshData()
  }, [])

  // Expose empty arrays during SSR to prevent hydration mismatch
  const value = isMounted
    ? { clients, taxes, obligations, installments, isLoading, refreshData }
    : { clients: [], taxes: [], obligations: [], installments: [], isLoading: true, refreshData }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
