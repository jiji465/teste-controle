"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ObligationWithDetails, Client } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"

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
  sem_regime: "#e2e8f0",
}

const STATUS_DATA_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"]
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendentes",
  in_progress: "Em Andamento",
  completed: "Concluídas",
  overdue: "Atrasadas",
}

export function RegimeDistributionChart({ obligations, clients }: RegimeDistributionChartProps) {
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    }
    obligations.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status]++
    })
    return Object.entries(counts)
      .map(([status, value]) => ({ name: STATUS_LABELS[status], value, status }))
      .filter((d) => d.value > 0)
  }, [obligations])

  const regimeData = useMemo(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const regime = c.taxRegime || "sem_regime"
      counts[regime] = (counts[regime] || 0) + 1
    })
    return Object.entries(counts)
      .map(([regime, value]) => ({
        name: regime === "sem_regime" ? "Sem regime" : (TAX_REGIME_LABELS as any)[regime] || regime,
        value,
        regime,
      }))
      .filter((d) => d.value > 0)
  }, [clients])

  const stateData = useMemo(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const state = c.state ? c.state.toUpperCase() : "Sem UF"
      counts[state] = (counts[state] || 0) + 1
    })
    return Object.entries(counts)
      .map(([state, value]) => ({ name: state, value, state }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [clients])

  // Paleta neutra rotativa pros estados (não tem cor "fixa" por UF)
  const STATE_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#ef4444", "#6366f1"]

  if (obligations.length === 0 && clients.length === 0) return null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Status das Obrigações */}
      {statusData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obrigações por Status</CardTitle>
            <CardDescription>Distribuição atual de {obligations.length} obrigações</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_DATA_COLORS[index % STATUS_DATA_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} obrigação${value !== 1 ? "ões" : ""}`, ""]}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Clientes por Regime */}
      {regimeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes por Regime Tributário</CardTitle>
            <CardDescription>{clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={regimeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {regimeData.map((entry) => (
                    <Cell
                      key={entry.regime}
                      fill={REGIME_HEX_COLORS[entry.regime] || "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} cliente${value !== 1 ? "s" : ""}`, ""]}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Empresas por Estado */}
      {stateData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas por Estado</CardTitle>
            <CardDescription>
              {stateData.length} UF{stateData.length !== 1 ? "s" : ""} com clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stateData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stateData.map((entry, index) => (
                    <Cell key={entry.state} fill={STATE_COLORS[index % STATE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} empresa${value !== 1 ? "s" : ""}`, ""]}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
