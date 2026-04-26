"use client"

import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ObligationWithDetails, Client } from "@/lib/types"
import { TAX_REGIME_LABELS } from "@/lib/types"

type RegimeDistributionChartProps = {
  obligations: ObligationWithDetails[]
  clients: Client[]
}

const REGIME_HEX_COLORS: Record<string, string> = {
  simples_nacional: "#10b981",
  lucro_presumido: "#3b82f6",
  lucro_real: "#8b5cf6",
  mei: "#f59e0b",
  imune_isento: "#6b7280",
  sem_regime: "#94a3b8",
}

const STATUS_DATA_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#10b981",
  overdue: "#ef4444",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendentes",
  in_progress: "Em Andamento",
  completed: "Concluídas",
  overdue: "Atrasadas",
}

const STATE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ef4444",
  "#6366f1",
]

type Datum = { name: string; value: number; color: string; key: string }

function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
      />
    </g>
  )
}

function DonutCard({
  title,
  description,
  data,
  totalLabel,
  unit,
}: {
  title: string
  description: string
  data: Datum[]
  totalLabel: string
  unit: { singular: string; plural: string }
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = useMemo(() => data.reduce((acc, d) => acc + d.value, 0), [data])
  const active = activeIndex !== null ? data[activeIndex] : null
  const activePct = active && total > 0 ? Math.round((active.value / total) * 100) : null

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={data.length > 1 ? 2 : 0}
                dataKey="value"
                stroke="hsl(var(--background))"
                strokeWidth={2}
                cornerRadius={4}
                activeIndex={activeIndex ?? undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={({ active: tipActive, payload }) => {
                  if (!tipActive || !payload || !payload.length) return null
                  const p = payload[0].payload as Datum
                  const pct = total > 0 ? Math.round((p.value / total) * 100) : 0
                  return (
                    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-medium">{p.name}</span>
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        {p.value} {p.value === 1 ? unit.singular : unit.plural} · {pct}%
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Centro: total ou seleção */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {active ? (
              <>
                <span className="text-2xl font-bold tabular-nums leading-none">{activePct}%</span>
                <span className="mt-1 max-w-[110px] truncate text-[11px] text-muted-foreground">
                  {active.name}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold tabular-nums leading-none">{total}</span>
                <span className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {totalLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legenda customizada */}
        <ul className="mt-3 space-y-1.5">
          {data.map((entry, idx) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
            const isActive = activeIndex === idx
            return (
              <li
                key={entry.key}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors cursor-default ${
                  isActive ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate">{entry.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="font-medium">{entry.value}</span>
                  <span className="w-9 text-right text-muted-foreground">{pct}%</span>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

export function RegimeDistributionChart({ obligations, clients }: RegimeDistributionChartProps) {
  const statusData = useMemo<Datum[]>(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, overdue: 0 }
    obligations.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status]++
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        key: status,
        name: STATUS_LABELS[status],
        value,
        color: STATUS_DATA_COLORS[status] || "#94a3b8",
      }))
  }, [obligations])

  const regimeData = useMemo<Datum[]>(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const regime = c.taxRegime || "sem_regime"
      counts[regime] = (counts[regime] || 0) + 1
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([regime, value]) => ({
        key: regime,
        name: regime === "sem_regime" ? "Sem regime" : (TAX_REGIME_LABELS as any)[regime] || regime,
        value,
        color: REGIME_HEX_COLORS[regime] || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value)
  }, [clients])

  const stateData = useMemo<Datum[]>(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const state = c.state ? c.state.toUpperCase() : "Sem UF"
      counts[state] = (counts[state] || 0) + 1
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([state, value], idx) => ({
        key: state,
        name: state,
        value,
        color: STATE_COLORS[idx % STATE_COLORS.length],
      }))
  }, [clients])

  if (obligations.length === 0 && clients.length === 0) return null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {statusData.length > 0 && (
        <DonutCard
          title="Obrigações por Status"
          description={`Distribuição atual de ${obligations.length} obrigações`}
          data={statusData}
          totalLabel="total"
          unit={{ singular: "obrigação", plural: "obrigações" }}
        />
      )}

      {regimeData.length > 0 && (
        <DonutCard
          title="Clientes por Regime Tributário"
          description={`${clients.length} cliente${clients.length !== 1 ? "s" : ""} cadastrado${clients.length !== 1 ? "s" : ""}`}
          data={regimeData}
          totalLabel="clientes"
          unit={{ singular: "cliente", plural: "clientes" }}
        />
      )}

      {stateData.length > 0 && (
        <DonutCard
          title="Empresas por Estado"
          description={`${stateData.length} UF${stateData.length !== 1 ? "s" : ""} com clientes`}
          data={stateData}
          totalLabel="empresas"
          unit={{ singular: "empresa", plural: "empresas" }}
        />
      )}
    </div>
  )
}
