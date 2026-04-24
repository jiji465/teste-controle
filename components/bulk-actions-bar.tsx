"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export type BulkAction = {
  label: string
  icon?: ReactNode
  onClick: () => void
  /** "default" = neutro, "success" = verde (concluir), "destructive" = vermelho */
  tone?: "default" | "success" | "destructive"
  disabled?: boolean
}

type Props = {
  selectedCount: number
  onClear: () => void
  actions: BulkAction[]
}

const TONE_CLASS: Record<NonNullable<BulkAction["tone"]>, string> = {
  default: "",
  success: "bg-green-600 hover:bg-green-700 text-white border-green-600",
  destructive: "text-destructive hover:text-destructive",
}

export function BulkActionsBar({ selectedCount, onClear, actions }: Props) {
  if (selectedCount === 0) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="font-mono">
          {selectedCount} selecionada{selectedCount > 1 ? "s" : ""}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs">
          <X className="size-3 mr-1" />
          Limpar seleção
        </Button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {actions.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant="outline"
            onClick={a.onClick}
            disabled={a.disabled}
            className={`h-8 ${TONE_CLASS[a.tone ?? "default"]}`}
          >
            {a.icon && <span className="mr-1.5">{a.icon}</span>}
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
