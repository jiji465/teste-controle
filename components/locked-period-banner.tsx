"use client"

import { Lock } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { useSelectedPeriod } from "@/contexts/period-context"

/** Faixa discreta abaixo do header quando a competência selecionada está
 *  fechada — deixa claro por que edições daquele mês são recusadas. */
export function LockedPeriodBanner() {
  const { period, showAll, periodLabel } = useSelectedPeriod()
  const { lockedPeriodInfo } = useData()
  if (showAll) return null
  const info = lockedPeriodInfo.find((p) => p.period === period)
  if (!info) return null

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-gold/40 bg-gold/10 px-4 py-2 text-xs text-foreground lg:px-6"
    >
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">Competência {periodLabel ?? period} fechada</strong>
        {info.lockedByName ? ` por ${info.lockedByName}` : ""}
        {info.lockedAt ? ` em ${new Date(info.lockedAt).toLocaleDateString("pt-BR")}` : ""}. Itens deste mês
        estão somente para leitura — reabra pelo cadeado no topo para alterar.
      </span>
    </div>
  )
}
