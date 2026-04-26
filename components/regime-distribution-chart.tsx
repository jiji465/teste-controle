"use client"

import { useMemo, useState } from "react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ObligationWithDetails, Client } from "@/lib/types"
import { TAX_REGIME_LABELS } from "@/lib/types"
import { BUSINESS_ACTIVITY_LABELS, type BusinessActivity } from "@/lib/obligation-templates"
import { CheckCircle2, Clock, AlertTriangle, Loader2, Building2, MapPin, Briefcase, ShoppingBag, Factory, Layers } from "lucide-react"

type RegimeDistributionChartProps = {
  obligations: ObligationWithDetails[]
  clients: Client[]
}

// === Cores base (cada uma vira um gradient via <defs>) ===
const REGIME_HEX_COLORS: Record<string, string> = {
  simples_nacional: "#10b981",
  lucro_presumido: "#3b82f6",
  lucro_real: "#8b5cf6",
  mei: "#f59e0b",
  imune_isento: "#6b7280",
  sem_regime: "#94a3b8",
}

const STATUS_META: Record<
  string,
  { label: string; color: string; lightBg: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "Pendentes", color: "#f59e0b", lightBg: "bg-amber-50 dark:bg-amber-950/30", icon: Clock },
  in_progress: { label: "Em Andamento", color: "#3b82f6", lightBg: "bg-blue-50 dark:bg-blue-950/30", icon: Loader2 },
  completed: { label: "Concluídas", color: "#10b981", lightBg: "bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2 },
  overdue: { label: "Atrasadas", color: "#ef4444", lightBg: "bg-red-50 dark:bg-red-950/30", icon: AlertTriangle },
}

const STATE_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899",
  "#06b6d4", "#f97316", "#84cc16", "#ef4444", "#6366f1",
]

// ============================================================
// CARD 1 — Saúde das Obrigações (radial gauge + chips de status)
// ============================================================
function ObligationsHealthCard({ obligations }: { obligations: ObligationWithDetails[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, overdue: 0 }
    for (const o of obligations) if (c[o.status] !== undefined) c[o.status]++
    return c
  }, [obligations])

  const total = obligations.length
  const completedPct = total > 0 ? Math.round((counts.completed / total) * 100) : 0
  const gaugeColor =
    completedPct >= 80 ? "#10b981" : completedPct >= 50 ? "#3b82f6" : completedPct >= 30 ? "#f59e0b" : "#ef4444"

  const gaugeData = [{ name: "completed", value: completedPct }]

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Saúde das Obrigações</span>
          <CheckCircle2 className="size-4 text-emerald-600" />
        </CardTitle>
        <CardDescription>{total} {total === 1 ? "obrigação" : "obrigações"} no total</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              cx="50%"
              cy="55%"
              innerRadius="75%"
              outerRadius="100%"
              barSize={18}
              data={gaugeData}
              startAngle={210}
              endAngle={-30}
            >
              <defs>
                <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={gaugeColor} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={gaugeColor} stopOpacity={1} />
                </linearGradient>
              </defs>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: "hsl(var(--muted))" }}
                dataKey="value"
                cornerRadius={12}
                fill="url(#gauge-grad)"
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-2">
            <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: gaugeColor }}>
              {completedPct}%
            </span>
            <span className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">concluído</span>
          </div>
        </div>

        {/* Chips de status */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(["completed", "in_progress", "pending", "overdue"] as const).map((key) => {
            const meta = STATUS_META[key]
            const Icon = meta.icon
            const count = counts[key]
            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${meta.lightBg} ${
                  count === 0 ? "opacity-50" : ""
                }`}
              >
                <Icon className="size-3.5 shrink-0" style={{ color: meta.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">
                    {meta.label}
                  </p>
                  <p className="text-base font-bold tabular-nums leading-tight" style={{ color: meta.color }}>
                    {count}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// CARD 2 — Regime Tributário (donut com gradients radiais)
// ============================================================
type RegimeDatum = { key: string; name: string; value: number; color: string }

function RegimeCard({ clients }: { clients: Client[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const data = useMemo<RegimeDatum[]>(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const r = c.taxRegime || "sem_regime"
      counts[r] = (counts[r] || 0) + 1
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

  const total = useMemo(() => data.reduce((acc, d) => acc + d.value, 0), [data])
  const top = data[0]
  const topPct = top && total > 0 ? Math.round((top.value / total) * 100) : 0

  if (data.length === 0) return null

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Regime Tributário</span>
          <Building2 className="size-4 text-blue-600" />
        </CardTitle>
        <CardDescription>{clients.length} cliente{clients.length !== 1 ? "s" : ""}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <defs>
                {data.map((d) => (
                  <radialGradient key={`grad-${d.key}`} id={`regime-grad-${d.key}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={d.color} stopOpacity={0.65} />
                  </radialGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={82}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                stroke="hsl(var(--background))"
                strokeWidth={2}
                cornerRadius={6}
                isAnimationActive={false}
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={`url(#regime-grad-${d.key})`} />
                ))}
              </Pie>
              {/* Tooltip removido — o centro + a legenda já mostram a mesma info,
                  e o tooltip flutuando sobre o centro causava sobreposição visual. */}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {activeIdx !== null && data[activeIdx] ? (
              <>
                <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: data[activeIdx].color }}>
                  {Math.round((data[activeIdx].value / total) * 100)}%
                </span>
                <span className="mt-0.5 max-w-[100px] truncate text-[10px] text-muted-foreground">
                  {data[activeIdx].name}
                </span>
              </>
            ) : top ? (
              <>
                <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: top.color }}>
                  {topPct}%
                </span>
                <span className="mt-0.5 max-w-[100px] truncate text-[10px] text-muted-foreground">
                  {top.name}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <ul className="mt-2 space-y-1">
          {data.map((d, idx) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
            return (
              <li
                key={d.key}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-default transition-colors ${
                  activeIdx === idx ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="font-medium tabular-nums">{d.value}</span>
                <span className="w-9 text-right text-muted-foreground tabular-nums">{pct}%</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// ============================================================
// CARD — Atividade Empresarial (barras verticais por categoria)
// ============================================================
const ACTIVITY_META: Record<
  BusinessActivity | "sem_atividade",
  { label: string; color: string; icon: typeof Briefcase }
> = {
  servicos: { label: "Serviços", color: "#3b82f6", icon: Briefcase },
  comercio: { label: "Comércio", color: "#f59e0b", icon: ShoppingBag },
  industria: { label: "Indústria", color: "#8b5cf6", icon: Factory },
  misto: { label: "Misto", color: "#10b981", icon: Layers },
  sem_atividade: { label: "—", color: "#94a3b8", icon: Briefcase },
}

function ActivityCard({ clients }: { clients: Client[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const a = (c.businessActivity as BusinessActivity) || "sem_atividade"
      counts[a] = (counts[a] || 0) + 1
    })
    // Mostra todas as categorias conhecidas (mesmo zeradas) pra dar consistência visual
    const order: (BusinessActivity | "sem_atividade")[] = ["servicos", "comercio", "industria", "misto"]
    return order.map((key) => ({
      key,
      label: ACTIVITY_META[key].label,
      color: ACTIVITY_META[key].color,
      icon: ACTIVITY_META[key].icon,
      value: counts[key] || 0,
    }))
  }, [clients])

  const total = useMemo(() => data.reduce((acc, d) => acc + d.value, 0), [data])
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Atividade Empresarial</span>
          <Briefcase className="size-4 text-amber-600" />
        </CardTitle>
        <CardDescription>
          {total} cliente{total !== 1 ? "s" : ""} classificado{total !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Barras verticais lado a lado */}
        <div className="flex items-end justify-around gap-2 h-[140px] pb-2">
          {data.map((d) => {
            const heightPct = (d.value / max) * 100
            const Icon = d.icon
            const isEmpty = d.value === 0
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: isEmpty ? undefined : d.color }}
                >
                  {d.value}
                </span>
                <div className="w-full max-w-[40px] h-full bg-muted/40 rounded-md overflow-hidden flex items-end relative">
                  <div
                    className="w-full rounded-md transition-all duration-500 group-hover:opacity-90"
                    style={{
                      height: isEmpty ? "4px" : `${Math.max(heightPct, 6)}%`,
                      background: isEmpty
                        ? "hsl(var(--muted))"
                        : `linear-gradient(180deg, ${d.color}, ${d.color}cc)`,
                    }}
                  />
                </div>
                <Icon
                  className={`size-4 ${isEmpty ? "text-muted-foreground/40" : ""}`}
                  style={{ color: isEmpty ? undefined : d.color }}
                />
              </div>
            )
          })}
        </div>
        {/* Labels */}
        <div className="flex items-start justify-around gap-1 mt-1">
          {data.map((d) => (
            <span
              key={d.key}
              className="flex-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground truncate px-0.5"
            >
              {d.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// CARD 3 — Empresas por Estado (leaderboard com barras horizontais)
// ============================================================
function StatesCard({ clients }: { clients: Client[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    clients.forEach((c) => {
      const state = c.state ? c.state.toUpperCase() : "—"
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

  const total = useMemo(() => data.reduce((acc, d) => acc + d.value, 0), [data])
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data])

  if (data.length === 0) return null

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Empresas por Estado</span>
          <MapPin className="size-4 text-purple-600" />
        </CardTitle>
        <CardDescription>
          {data.length} UF{data.length !== 1 ? "s" : ""} · {total} empresa{total !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="space-y-2.5">
          {data.slice(0, 8).map((d, idx) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
            const widthPct = (d.value / max) * 100
            return (
              <li key={d.key} className="group">
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="shrink-0 size-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${d.color}, ${d.color}dd)` }}
                  >
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold tracking-wide">{d.name}</span>
                  <div className="flex-1" />
                  <span className="text-sm font-bold tabular-nums">{d.value}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{pct}%</span>
                </div>
                <div className="ml-10 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                    style={{
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, ${d.color}aa, ${d.color})`,
                    }}
                  />
                </div>
              </li>
            )
          })}
          {data.length > 8 && (
            <li className="text-xs text-muted-foreground text-center pt-1">
              + {data.length - 8} estados
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Wrapper público — grid adaptativo (preenche o espaço com qualquer #)
// ============================================================
export function RegimeDistributionChart({ obligations, clients }: RegimeDistributionChartProps) {
  if (obligations.length === 0 && clients.length === 0) return null

  const cards = [
    obligations.length > 0 && <ObligationsHealthCard key="health" obligations={obligations} />,
    clients.length > 0 && <RegimeCard key="regime" clients={clients} />,
    clients.length > 0 && <ActivityCard key="activity" clients={clients} />,
    clients.length > 0 && <StatesCard key="states" clients={clients} />,
  ].filter(Boolean)

  // Grid adaptativo:
  // 4 cards → 2x2 no md, 4 cols no xl
  // 3 cards → 3 cols
  // 2 cards → 2 cols (preenche)
  // 1 card → centralizado
  const gridClass =
    cards.length >= 4
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      : cards.length === 3
        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        : cards.length === 2
          ? "grid gap-4 sm:grid-cols-2"
          : "grid gap-4 max-w-md mx-auto"

  return <div className={gridClass}>{cards}</div>
}
