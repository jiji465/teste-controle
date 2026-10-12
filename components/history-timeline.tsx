"use client"

import { useEffect, useState } from "react"
import { History, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { getHistory, type HistoryEntityType, type HistoryRecord } from "@/features/history/services"

type LocalEntry = { id: string; description: string; timestamp: string; user?: string }

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

/**
 * Histórico do item: trilha do banco (quem fez o quê e quando) + anotações
 * locais do próprio registro, mais recentes primeiro.
 */
export function HistoryTimeline({
  entityType,
  entityId,
  localEntries,
}: {
  entityType: HistoryEntityType
  entityId: string
  localEntries?: LocalEntry[]
}) {
  const [remote, setRemote] = useState<HistoryRecord[] | null>(null)

  useEffect(() => {
    let alive = true
    getHistory(entityType, entityId).then((r) => alive && setRemote(r))
    return () => {
      alive = false
    }
  }, [entityType, entityId])

  const entries = [
    ...(remote ?? []).map((r) => ({ id: r.id, description: r.description, at: r.createdAt, user: r.userName })),
    ...(localEntries ?? []).map((l) => ({ id: `l-${l.id}`, description: l.description, at: l.timestamp, user: l.user })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15)

  if (remote !== null && entries.length === 0) return null

  return (
    <>
      <Separator />
      <div>
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Histórico</p>
          {remote === null && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-foreground">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(e.at)}
                  {e.user && e.user !== "Sistema" ? ` · ${e.user}` : e.user === "Sistema" ? " · automático" : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
