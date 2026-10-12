"use client"

/**
 * Fechar / reabrir a competência selecionada no topo.
 *
 * A trava vive no banco (scripts/020_locked_periods.sql): depois de fechada,
 * nenhum usuário consegue criar, editar ou apagar obrigações, guias ou
 * serviços daquela competência — o próprio banco recusa. Antes de fechar,
 * mostra o que ainda está pendente no mês, pra ninguém fechar às cegas.
 */

import { useMemo, useState } from "react"
import { Lock, LockOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useData } from "@/contexts/data-context"
import { useAuth } from "@/contexts/auth-context"
import { useSelectedPeriod } from "@/contexts/period-context"
import { cn } from "@/lib/utils"

const monthLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

export function PeriodLockControl() {
  const { period, showAll } = useSelectedPeriod()
  const { obligationsWithDetails, taxes, services, lockedPeriodInfo, togglePeriodLock } = useData()
  const { isViewer } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const info = useMemo(() => lockedPeriodInfo.find((p) => p.period === period), [lockedPeriodInfo, period])
  const locked = !!info

  // Pendências da competência (o que ainda não foi concluído)
  const pending = useMemo(() => {
    const inPeriod = (comp?: string) => !!comp && comp.slice(0, 7) === period
    return {
      obligations: obligationsWithDetails.filter((o) => inPeriod(o.competencyMonth) && o.status !== "completed").length,
      taxes: taxes.filter((t) => inPeriod(t.competencyMonth) && t.status !== "completed").length,
      services: services.filter((s) => inPeriod(s.dueDate) && s.status !== "completed").length,
    }
  }, [obligationsWithDetails, taxes, services, period])
  const totalPending = pending.obligations + pending.taxes + pending.services

  if (showAll || !/^\d{4}-\d{2}$/.test(period)) return null

  const label = monthLabel(period)
  const lockedTitle = info
    ? `Competência fechada${info.lockedByName ? ` por ${info.lockedByName}` : ""}${
        info.lockedAt ? ` em ${new Date(info.lockedAt).toLocaleDateString("pt-BR")}` : ""
      }`
    : ""

  // Visualizador só vê o estado, não altera.
  if (isViewer) {
    if (!locked) return null
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        title={lockedTitle}
      >
        <Lock className="size-3" /> Fechada
      </span>
    )
  }

  const confirm = async () => {
    setBusy(true)
    try {
      await togglePeriodLock(period)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            aria-label={locked ? `Reabrir competência de ${label}` : `Fechar competência de ${label}`}
            className={cn(
              "h-9 gap-1.5 rounded-full px-3 text-[11px] font-semibold",
              locked && "border border-gold/50 bg-gold/10 text-foreground hover:bg-gold/20",
            )}
          >
            {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-muted-foreground" />}
            <span className="hidden xl:inline">{locked ? "Fechada" : "Fechar mês"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{locked ? lockedTitle : `Fechar a competência de ${label}`}</TooltipContent>
      </Tooltip>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locked ? `Reabrir ${label}?` : `Fechar a competência de ${label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {locked ? (
                  <p>
                    {lockedTitle}. Ao reabrir, todos os usuários voltam a poder criar, editar e
                    excluir itens desta competência.
                  </p>
                ) : (
                  <>
                    <p>
                      Depois de fechada, ninguém consegue criar, editar ou excluir obrigações, guias e
                      serviços desta competência até que ela seja reaberta.
                    </p>
                    {totalPending > 0 ? (
                      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-foreground">
                        <p className="font-medium">Ainda há {totalPending} {totalPending === 1 ? "item pendente" : "itens pendentes"} nesta competência:</p>
                        <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                          {pending.obligations > 0 && <li>{pending.obligations} obrigação(ões)</li>}
                          {pending.taxes > 0 && <li>{pending.taxes} guia(s)</li>}
                          {pending.services > 0 && <li>{pending.services} serviço(s)</li>}
                        </ul>
                      </div>
                    ) : (
                      <p className="rounded-md border border-success/40 bg-success/10 p-3 text-foreground">
                        Tudo concluído nesta competência.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void confirm()
              }}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {locked ? "Reabrir competência" : totalPending > 0 ? "Fechar mesmo assim" : "Fechar competência"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
