"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { Client, Tax, Obligation, Installment } from "@/lib/types"
import { getClients, getTaxes, getObligations, getInstallments } from "@/lib/supabase/database"
import { seedDefaultTemplates } from "@/lib/obligation-templates"
import { getCustomTemplatesAsync } from "@/features/templates/services"

interface DataContextType {
  clients: Client[]
  taxes: Tax[]
  obligations: Obligation[]
  installments: Installment[]
  lockedPeriods: string[]
  isLoading: boolean
  isRefreshing: boolean
  lastRefreshAt: number | null
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const refreshData = async () => {
    // Primeira carga marca isLoading; refreshes seguintes só marcam isRefreshing
    setIsRefreshing(true)
    if (lastRefreshAt === null) setIsLoading(true)
    try {
      const { getLockedPeriods } = await import("@/lib/supabase/database")
      const [cls, txs, obs, insts, lps] = await Promise.all([
        getClients(),
        getTaxes(),
        getObligations(),
        getInstallments(),
        getLockedPeriods(),
        // Templates: força ler do Supabase e atualizar localStorage
        getCustomTemplatesAsync().catch((e) => {
          console.error("[data] Erro ao buscar templates:", e)
          return []
        }),
      ])
      setClients(cls)
      setTaxes(txs)
      setObligations(obs)
      setInstallments(insts)
      setLockedPeriods(lps)
      setLastRefreshAt(Date.now())
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
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
    seedDefaultTemplates()
    refreshData()
  }, [])

  // Auto-refresh ao voltar para a aba (sem polling). Só dispara se passou
  // mais de 10s desde o último refresh, pra não martelar o banco.
  useEffect(() => {
    if (!isMounted) return
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      const elapsed = lastRefreshAt ? Date.now() - lastRefreshAt : Infinity
      if (elapsed > 10_000) {
        refreshData()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [isMounted, lastRefreshAt])

  // Expose empty arrays during SSR to prevent hydration mismatch
  const value = isMounted
    ? { clients, taxes, obligations, installments, lockedPeriods, isLoading, isRefreshing, lastRefreshAt, refreshData, togglePeriodLock }
    : { clients: [], taxes: [], obligations: [], installments: [], lockedPeriods: [], isLoading: true, isRefreshing: false, lastRefreshAt: null, refreshData, togglePeriodLock }

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
