"use client"

import React, { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef, ReactNode } from "react"
import { toast } from "sonner"
import type { Client, Tax, Obligation, Installment, Service, ObligationWithDetails } from "@/lib/types"
import { getClients, getTaxes, getObligations, getInstallments } from "@/lib/supabase/database"
import { getServices } from "@/features/services/services"
import { getLockedPeriods, lockPeriod, unlockPeriod, type LockedPeriod } from "@/features/periods/services"
import { getObligationsWithDetails } from "@/lib/dashboard-utils"
import { setExtraHolidays } from "@/lib/date-utils"
import { getOfficeHolidays } from "@/features/settings/services"
import { useAuth } from "@/contexts/auth-context"
import { hasSupabaseConfig } from "@/lib/supabase/core"
// seedDefaultTemplates foi movido pra rodar SÓ na página /templates pra
// evitar duas chamadas concorrentes (era chamado aqui E lá, gerando race
// conditions com o sync do Supabase).
import { getCustomTemplatesAsync } from "@/features/templates/services"

interface DataContextType {
  clients: Client[]
  taxes: Tax[]
  obligations: Obligation[]
  /** Obrigações já enriquecidas (cliente + tax + calculatedDueDate) — memoizado.
   *  Usar isso em vez de chamar getObligationsWithDetails em cada página. */
  obligationsWithDetails: ObligationWithDetails[]
  installments: Installment[]
  services: Service[]
  /** Competências fechadas ("YYYY-MM") */
  lockedPeriods: string[]
  /** Detalhes do fechamento (quem/quando) por competência */
  lockedPeriodInfo: LockedPeriod[]
  isLoading: boolean
  isRefreshing: boolean
  lastRefreshAt: number | null
  /** Mensagem da última falha de carga (null = ok) */
  loadError: string | null
  refreshData: () => Promise<void>
  togglePeriodLock: (period: string) => Promise<void>
  isPeriodLocked: (period: string | undefined | null) => boolean
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, role, isLoading: authLoading } = useAuth()
  // O que este usuário pode carregar (espelha o RLS do scripts/023):
  //  - sem Supabase (modo local): tudo, do localStorage;
  //  - sem papel / login anônimo: nada (o banco não devolve linhas);
  //  - viewer: só Empresas + obrigações (indicadores) + fechamentos/feriados;
  //  - editor/admin: tudo.
  const offline = !hasSupabaseConfig()
  const scope: "none" | "viewer" | "full" = offline ? "full" : !user || !role ? "none" : role === "viewer" ? "viewer" : "full"
  const [clients, setClients] = useState<Client[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [lockedPeriodInfo, setLockedPeriodInfo] = useState<LockedPeriod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  // Cada refresh ganha um número; só a resposta do MAIS RECENTE é aplicada
  // (evita uma resposta antiga sobrescrever uma nova quando dois refreshes
  // se sobrepõem — ex.: salvar + voltar à aba).
  const requestSeq = useRef(0)
  const loadedOnce = useRef(false)
  const retryRef = useRef<() => Promise<void>>(async () => {})

  const refreshData = useCallback(async () => {
    const seq = ++requestSeq.current
    const s = scope
    if (s === "none") {
      // Sem papel: não consulta o banco (o RLS devolveria tudo vazio).
      setClients([]); setTaxes([]); setObligations([]); setInstallments([]); setServices([]); setLockedPeriodInfo([])
      setLoadError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }
    const full = s === "full"
    setIsRefreshing(true)
    if (!loadedOnce.current) setIsLoading(true)
    try {
      const [cls, txs, obs, insts, svcs, lps, holidays] = await Promise.all([
        getClients(),
        // Guias, parcelamentos e serviços são só da equipe (viewer não lê no banco)
        full ? getTaxes() : Promise.resolve([] as Tax[]),
        getObligations(),
        full ? getInstallments() : Promise.resolve([] as Installment[]),
        full ? getServices() : Promise.resolve([] as Service[]),
        getLockedPeriods(),
        // Feriados locais: falha aqui não derruba a carga (só ficam os nacionais)
        getOfficeHolidays().catch((e) => {
          console.warn("[data] Feriados locais indisponíveis:", e)
          return []
        }),
        // Templates: força ler do Supabase e atualizar o cache local (só equipe)
        full
          ? getCustomTemplatesAsync().catch((e) => {
              console.error("[data] Erro ao buscar templates:", e)
              return []
            })
          : Promise.resolve([]),
      ])
      if (seq !== requestSeq.current) return
      // Antes de publicar os dados: todo cálculo de vencimento já usa os feriados locais
      setExtraHolidays(holidays)
      setClients(cls)
      setTaxes(txs)
      setObligations(obs)
      setInstallments(insts)
      setServices(svcs)
      setLockedPeriodInfo(lps)
      setLastRefreshAt(Date.now())
      setLoadError(null)
      loadedOnce.current = true
    } catch (error) {
      if (seq !== requestSeq.current) return
      const msg = error instanceof Error ? error.message : String(error)
      console.error("Error fetching data:", error)
      setLoadError(msg)
      toast.error("Não foi possível carregar os dados", {
        id: "data-load-error",
        description: `${msg}. Os dados exibidos podem estar desatualizados.`,
        action: { label: "Tentar de novo", onClick: () => void retryRef.current() },
        duration: 15_000,
      })
    } finally {
      if (seq === requestSeq.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [scope])

  useEffect(() => {
    retryRef.current = refreshData
  }, [refreshData])

  const lockedPeriods = useMemo(() => lockedPeriodInfo.map((p) => p.period), [lockedPeriodInfo])

  const isPeriodLocked = useCallback(
    (period: string | undefined | null) => !!period && lockedPeriods.includes(period.slice(0, 7)),
    [lockedPeriods],
  )

  const togglePeriodLock = useCallback(
    async (period: string) => {
      const who = (user?.user_metadata?.name as string | undefined) ?? user?.email ?? undefined
      try {
        if (lockedPeriods.includes(period)) await unlockPeriod(period)
        else await lockPeriod(period, who)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao alterar o fechamento")
        return
      }
      await refreshData()
    },
    [lockedPeriods, user, refreshData],
  )

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Recarrega quando a sessão ou o papel mudam (login/logout/troca de usuário).
  // Espera o Auth terminar de carregar para não consultar o banco sem papel.
  useEffect(() => {
    if (authLoading && !offline) return
    void refreshData()
  }, [user?.id, scope, authLoading, offline, refreshData])

  // Auto-refresh ao voltar para a aba (sem polling). Só dispara se passou
  // mais de 10s desde o último refresh, pra não martelar o banco.
  useEffect(() => {
    if (!isMounted) return
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      const elapsed = lastRefreshAt ? Date.now() - lastRefreshAt : Infinity
      if (elapsed > 10_000) {
        void refreshData()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [isMounted, lastRefreshAt, refreshData])

  // Memoiza obligationsWithDetails — evita 4 páginas chamarem a função O(n*m)
  // separadamente em cada render. Recalcula só quando dados base mudam.
  const obligationsWithDetails = useMemo(
    () => getObligationsWithDetails(obligations, clients, taxes),
    [obligations, clients, taxes],
  )

  // Expose empty arrays during SSR to prevent hydration mismatch
  const value: DataContextType = isMounted
    ? { clients, taxes, obligations, obligationsWithDetails, installments, services, lockedPeriods, lockedPeriodInfo, isLoading, isRefreshing, lastRefreshAt, loadError, refreshData, togglePeriodLock, isPeriodLocked }
    : { clients: [], taxes: [], obligations: [], obligationsWithDetails: [], installments: [], services: [], lockedPeriods: [], lockedPeriodInfo: [], isLoading: true, isRefreshing: false, lastRefreshAt: null, loadError: null, refreshData, togglePeriodLock, isPeriodLocked: () => false }

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
