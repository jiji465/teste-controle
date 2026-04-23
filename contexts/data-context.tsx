"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { Client, Tax, Obligation, Installment } from "@/lib/types"
import { getClients, getTaxes, getObligations, getInstallments } from "@/lib/supabase/database"

interface DataContextType {
  clients: Client[]
  taxes: Tax[]
  obligations: Obligation[]
  installments: Installment[]
  lockedPeriods: string[]
  isLoading: boolean
  refreshData: () => Promise<void>
  togglePeriodLock: (period: string) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [lockedPeriods, setLockedPeriods] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  const refreshData = async () => {
    setIsLoading(true)
    try {
      const { getLockedPeriods } = await import("@/lib/supabase/database")
      const [cls, txs, obs, insts, lps] = await Promise.all([
        getClients(),
        getTaxes(),
        getObligations(),
        getInstallments(),
        getLockedPeriods(),
      ])
      setClients(cls)
      setTaxes(txs)
      setObligations(obs)
      setInstallments(insts)
      setLockedPeriods(lps)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const togglePeriodLock = async (period: string) => {
    const { getLockedPeriods, lockPeriod, unlockPeriod } = await import("@/lib/supabase/database")
    const periods = getLockedPeriods()
    if (periods.includes(period)) {
      unlockPeriod(period)
    } else {
      lockPeriod(period)
    }
    await refreshData()
  }

  useEffect(() => {
    setIsMounted(true)
    refreshData()
  }, [])

  // Expose empty arrays during SSR to prevent hydration mismatch
  const value = isMounted
    ? { clients, taxes, obligations, installments, lockedPeriods, isLoading, refreshData, togglePeriodLock }
    : { clients: [], taxes: [], obligations: [], installments: [], lockedPeriods: [], isLoading: true, refreshData, togglePeriodLock }

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
