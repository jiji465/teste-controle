"use client"

/**
 * RelatoriosFilters — barra rica de filtros pra página /relatorios.
 *
 * - Date range com presets ("Últimos 30 dias", "Este mês", etc) + custom
 * - Multi-cliente (popover com checkboxes)
 * - Filtro de status (múltipla escolha)
 * - Esfera (federal/estadual/municipal)
 * - Chips de filtro rápido + botão "Limpar"
 *
 * Persiste o último filtro em localStorage pra resistir a reloads.
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CalendarRange,
  Building2,
  Layers,
  Filter,
  Tag,
  X,
  Check,
} from "lucide-react"
import type { Client } from "@/lib/types"
import { rangeFromPreset, formatRange, PRESET_LABELS, type DateRange, type DateRangePreset } from "@/lib/date-range"

export type RelatoriosFilterState = {
  preset: DateRangePreset
  range: DateRange
  clientIds: string[]
  statuses: Array<"pending" | "in_progress" | "completed" | "overdue">
  scope: "all" | "federal" | "estadual" | "municipal"
}

const STORAGE_KEY = "ctrl-fiscal:relatorios-filters"

export const DEFAULT_FILTERS: RelatoriosFilterState = {
  preset: "thisMonth",
  range: rangeFromPreset("thisMonth"),
  clientIds: [],
  statuses: [],
  scope: "all",
}

const STATUS_LABELS: Record<NonNullable<RelatoriosFilterState["statuses"][number]>, string> = {
  pending: "Pendente",
  in_progress: "Em Andamento",
  completed: "Concluído",
  overdue: "Atrasado",
}

export function loadStoredFilters(): RelatoriosFilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FILTERS
    const parsed = JSON.parse(raw) as RelatoriosFilterState
    // Re-resolve preset (não persiste range pra "today/last30" pq mudam a cada dia)
    if (parsed.preset && parsed.preset !== "custom") {
      parsed.range = rangeFromPreset(parsed.preset)
    }
    return parsed
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilters(filters: RelatoriosFilterState) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {}
}

type Props = {
  clients: Client[]
  value: RelatoriosFilterState
  onChange: (next: RelatoriosFilterState) => void
}

const QUICK_PRESETS: DateRangePreset[] = ["last7", "last30", "thisMonth", "thisYear", "all"]

export function RelatoriosFilters({ clients, value, onChange }: Props) {
  const [clientOpen, setClientOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [clientQuery, setClientQuery] = useState("")

  useEffect(() => {
    saveFilters(value)
  }, [value])

  const setPreset = (preset: DateRangePreset) => {
    onChange({ ...value, preset, range: rangeFromPreset(preset) })
  }

  const setCustomRange = (range: DateRange) => {
    onChange({ ...value, preset: "custom", range })
  }

  const toggleClient = (id: string) => {
    const next = value.clientIds.includes(id)
      ? value.clientIds.filter((c) => c !== id)
      : [...value.clientIds, id]
    onChange({ ...value, clientIds: next })
  }

  const toggleStatus = (s: RelatoriosFilterState["statuses"][number]) => {
    const next = value.statuses.includes(s)
      ? value.statuses.filter((x) => x !== s)
      : [...value.statuses, s]
    onChange({ ...value, statuses: next })
  }

  const reset = () => onChange(DEFAULT_FILTERS)

  const filteredClients = clientQuery.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(clientQuery.toLowerCase()))
    : clients

  const activeCount =
    (value.preset !== "thisMonth" ? 1 : 0) +
    (value.clientIds.length > 0 ? 1 : 0) +
    (value.statuses.length > 0 ? 1 : 0) +
    (value.scope !== "all" ? 1 : 0)

  return (
    <div className="space-y-3">
      {/* Chips de filtro rápido (presets) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tag className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Rápido:</span>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              value.preset === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border"
            }`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Filtros principais */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <CalendarRange className="size-3.5" />
              {formatRange(value.range)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-3" align="start">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Período personalizado
            </Label>
            <div className="grid gap-2 grid-cols-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={value.range.from ?? ""}
                  onChange={(e) => setCustomRange({ ...value.range, from: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={value.range.to ?? ""}
                  onChange={(e) => setCustomRange({ ...value.range, to: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Deixe em branco pra remover o limite. Atalhos rápidos acima ⬆
            </p>
          </PopoverContent>
        </Popover>

        {/* Clientes (multi) */}
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Building2 className="size-3.5" />
              {value.clientIds.length === 0
                ? "Todos os clientes"
                : value.clientIds.length === 1
                  ? clients.find((c) => c.id === value.clientIds[0])?.name ?? "Cliente"
                  : `${value.clientIds.length} clientes`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Buscar cliente…"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {value.clientIds.length > 0 && (
                <button
                  className="w-full text-left text-xs text-muted-foreground px-2 py-1.5 hover:bg-muted rounded"
                  onClick={() => onChange({ ...value, clientIds: [] })}
                >
                  Limpar seleção ({value.clientIds.length})
                </button>
              )}
              {filteredClients.map((c) => {
                const selected = value.clientIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClient(c.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-muted ${
                      selected ? "bg-primary/5 text-primary" : ""
                    }`}
                  >
                    <Checkbox checked={selected} className="pointer-events-none" />
                    <span className="flex-1 min-w-0 truncate">{c.name}</span>
                    {selected && <Check className="size-3.5 shrink-0" />}
                  </button>
                )
              })}
              {filteredClients.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  Nenhum cliente encontrado
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status (multi) */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Filter className="size-3.5" />
              {value.statuses.length === 0
                ? "Todos os status"
                : value.statuses.length === 1
                  ? STATUS_LABELS[value.statuses[0]]
                  : `${value.statuses.length} status`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-1" align="start">
            {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => {
              const selected = value.statuses.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-muted ${
                    selected ? "bg-primary/5 text-primary" : ""
                  }`}
                >
                  <Checkbox checked={selected} className="pointer-events-none" />
                  <span className="flex-1">{STATUS_LABELS[s]}</span>
                </button>
              )
            })}
          </PopoverContent>
        </Popover>

        {/* Esfera */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Layers className="size-3.5" />
              {value.scope === "all" ? "Todas esferas" : value.scope === "federal" ? "Federal" : value.scope === "estadual" ? "Estadual" : "Municipal"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[180px] p-1" align="start">
            {(["all", "federal", "estadual", "municipal"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onChange({ ...value, scope: s })}
                className={`w-full px-2 py-1.5 rounded text-sm text-left hover:bg-muted ${
                  value.scope === s ? "bg-primary/5 text-primary font-medium" : ""
                }`}
              >
                {s === "all" ? "Todas" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9 text-xs text-muted-foreground">
            <X className="size-3.5 mr-1" /> Limpar filtros ({activeCount})
          </Button>
        )}

        <div className="ml-auto">
          <Badge variant="outline" className="text-[10px]">
            {value.statuses.length === 0 && value.scope === "all" && value.clientIds.length === 0
              ? "Mostrando tudo"
              : `${activeCount} filtro${activeCount !== 1 ? "s" : ""} ativo${activeCount !== 1 ? "s" : ""}`}
          </Badge>
        </div>
      </div>
    </div>
  )
}
