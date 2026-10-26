"use client"

/**
 * ReportsPanel — reformulação ousada.
 *
 * Mudanças vs. versão anterior:
 *   - Filtros expandidos (date range + multi-cliente + multi-status + esfera)
 *   - SEM tabs — todas as seções renderizam verticalmente com âncoras
 *   - Compliance score por cliente (A/B/C)
 *   - Tempo médio de conclusão
 *   - Heatmap de vencimentos do mês
 *   - Comparativo ano anterior
 *   - Evolução 12 meses (era 6) com taxa de conclusão sobreposta
 *   - Reusa RegimeDistributionChart pra dar contexto
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Printer,
  Download,
  BarChart3,
  CreditCard,
  Award,
  Hourglass,
  CalendarHeart,
  Activity,
} from "lucide-react"
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts"
import type { ReportData } from "@/lib/report-types"
import { buildReportData, buildReportModel } from "@/lib/report-model"
import { toast } from "sonner"
import type { ObligationWithDetails, Tax, Installment, Service, Client } from "@/lib/types"
import { formatDate } from "@/lib/date-utils"
import { RelatoriosFilters, loadStoredFilters, type RelatoriosFilterState } from "./relatorios-filters"
import { ComplianceScoreList } from "./compliance-score-list"
import { AvgCompletionTime } from "./avg-completion-time"
import { HeatmapVencimentos } from "./heatmap-vencimentos"
import { HeatmapEntregas } from "./heatmap-entregas"
import { YoYComparison } from "./yoy-comparison"

type Props = {
  obligations: ObligationWithDetails[]
  taxes?: Tax[]
  installments?: Installment[]
  services?: Service[]
  clients?: Client[]
}

export function ReportsPanel({
  obligations,
  taxes = [],
  installments = [],
  services = [],
  clients = [],
}: Props) {
  // Inicializa do localStorage (resolve preset → range)
  const [filters, setFilters] = useState<RelatoriosFilterState>(() => loadStoredFilters())

  // Estado de "ver todos" pra listas longas — colapsa por padrão pra reduzir
  // o tamanho vertical da página (sem isso a página fica enorme).
  const [showAllByClient, setShowAllByClient] = useState(false)
  const [showAllByTax, setShowAllByTax] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  // ─── Modelo (filtros, contagens, tabelas) — lib/report-model (testado) ──
  // Parcelamentos contam parcela a parcela (status filtrado por parcela);
  // "No prazo" compara por DIA e soma os 4 tipos, igual ao Total Combinado.
  const model = useMemo(
    () => buildReportModel({ obligations, taxes, installments, services, clients }, filters),
    [obligations, taxes, installments, services, clients, filters],
  )
  const {
    filteredObligations,
    filteredTaxes,
    filteredInstallments,
    filteredServices,
    stats,
    allStatus,
    taxesCompleted,
    parcelasCompleted,
    totalParcelas,
    servicesCompleted,
    totalAll,
    totalCompletedAll,
    overallRate,
    onTime,
    monthlyEvolution,
    heatmapMonthKey,
    byClient,
    byTax,
    byRecurrence,
    unifiedCompleted,
    installmentsInPeriodTable,
  } = model

  // Matéria-prima única dos relatórios (Excel + PDF leem o mesmo objeto)
  const reportData = useMemo<ReportData>(() => buildReportData(model), [model])

  const handleExportExcel = async () => {
    try {
      // Carregado sob demanda: ExcelJS só baixa quando alguém exporta
      const { exportRelatorioExcel } = await import("@/lib/report-excel")
      await exportRelatorioExcel(reportData)
      toast.success("Excel gerado")
    } catch (e) {
      console.error("[relatorios] erro ao gerar Excel:", e)
      toast.error("Erro ao gerar Excel")
    }
  }

  const handleExportPdf = async () => {
    try {
      const { exportRelatorioPdf } = await import("@/lib/report-pdf")
      exportRelatorioPdf(reportData)
      toast.success("PDF gerado")
    } catch (e) {
      console.error("[relatorios] erro ao gerar PDF:", e)
      toast.error("Erro ao gerar PDF")
    }
  }

  // ─── Empty state ────────────────────────────────────────────────────────
  if (totalAll === 0) {
    return (
      <div className="space-y-4">
        <RelatoriosFilters clients={clients} value={filters} onChange={setFilters} />
        <div className="border-2 border-dashed rounded-xl py-16 px-6 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhum dado nos filtros atuais</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Ajuste os filtros acima ou cadastre obrigações/guias/parcelamentos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barra de filtros — sempre visível no topo */}
      <RelatoriosFilters clients={clients} value={filters} onChange={setFilters} />

      {/* Botões de ação */}
      <div className="flex items-center justify-end gap-2 no-print">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
          <Download className="size-4" /> Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2">
          <Download className="size-4" /> Exportar PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      {/* Navegação por âncoras */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs no-print" aria-label="Navegação rápida">
        <span className="text-muted-foreground">Pular pra:</span>
        {[
          { href: "#resumo", label: "Resumo" },
          { href: "#evolucao", label: "Evolução" },
          { href: "#compliance", label: "Compliance" },
          { href: "#heatmap", label: "Picos do mês" },
          { href: "#entregas", label: "Entregas/dia" },
          { href: "#cliente", label: "Por Cliente" },
          { href: "#imposto", label: "Por Imposto" },
          { href: "#parcelamentos", label: "Parcelamentos" },
          { href: "#concluidas", label: "Concluídas" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="px-2 py-0.5 rounded-full border border-border hover:bg-muted transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {/* ─── RESUMO ─── */}
      <section id="resumo" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" /> Resumo Geral
        </h2>

        {/* Visão Geral Combinada */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Combinado</CardTitle>
            <CardDescription className="text-xs">
              {totalCompletedAll} de {totalAll} concluídos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Taxa global</p>
                <p className="text-2xl font-bold">{overallRate}%</p>
                <Progress value={overallRate} className="mt-2 h-1.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Obrigações</p>
                <p className="text-2xl font-bold tabular-nums">
                  {stats.completed.length}/{filteredObligations.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Guias de Imposto</p>
                <p className="text-2xl font-bold tabular-nums">
                  {taxesCompleted}/{filteredTaxes.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parcelas no período</p>
                <p className="text-2xl font-bold tabular-nums">
                  {parcelasCompleted}/{totalParcelas}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serviços</p>
                <p className="text-2xl font-bold tabular-nums">
                  {servicesCompleted}/{filteredServices.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards — incluindo Tempo Médio e YoY */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" /> Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{allStatus.completed}</p>
              <Progress value={overallRate} className="mt-2" />
              <p className="text-[11px] text-muted-foreground mt-1">
                de {totalAll} · obrigações, guias, parcelas e serviços
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-blue-600" /> No Prazo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{onTime.all.onTime}</p>
              <Progress value={onTime.all.rate} className="mt-2" />
              <p className="text-[11px] text-muted-foreground mt-1">
                {onTime.all.rate}% das {onTime.all.completed} concluídas (todos os tipos) · até o dia do vencimento
              </p>
            </CardContent>
          </Card>
          <AvgCompletionTime
            obligations={filteredObligations}
            taxes={filteredTaxes}
            installments={filteredInstallments}
          />
          <YoYComparison
            obligations={obligations}
            taxes={taxes}
            installments={installments}
            range={filters.range}
          />
        </div>

        {/* Status detalhado — soma dos 4 tipos (bate com o Total Combinado) */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="size-4 text-blue-600" /> Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{allStatus.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hourglass className="size-4 text-amber-600" /> Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{allStatus.pending}</p>
            </CardContent>
          </Card>
          <Card className={allStatus.overdue > 0 ? "ring-2 ring-red-500/30" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-600" /> Atrasadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-red-600">{allStatus.overdue}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── EVOLUÇÃO 12 MESES + linha de taxa ─── */}
      <section id="evolucao" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" /> Evolução nos últimos 12 meses
            </CardTitle>
            <CardDescription className="text-xs">
              Barras: contagem por status. Linha: taxa de conclusão (%).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis yAxisId="left" allowDecimals={false} className="text-xs" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  className="text-xs"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    fontSize: "12px",
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
                <Bar yAxisId="left" dataKey="concluidas" stackId="a" fill="#10b981" name="Concluídas" />
                <Bar yAxisId="left" dataKey="pendentes" stackId="a" fill="#f59e0b" name="Pendentes" />
                <Bar yAxisId="left" dataKey="atrasadas" stackId="a" fill="#ef4444" name="Atrasadas" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Taxa conclusão %"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* ─── COMPLIANCE SCORE ─── */}
      {/* Passa dados já filtrados pelo date range — antes o score ignorava
          o filtro e mostrava nota global, confundindo "Janeiro/2026" com
          o histórico inteiro do cliente. */}
      <section id="compliance" className="scroll-mt-20">
        <ComplianceScoreList
          clients={clients}
          obligations={filteredObligations}
          taxes={filteredTaxes}
          installments={filteredInstallments}
          services={filteredServices}
        />
      </section>

      {/* ─── HEATMAP DE PICOS ─── */}
      <section id="heatmap" className="scroll-mt-20">
        <HeatmapVencimentos
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          services={services}
          monthKey={heatmapMonthKey}
          isAllPeriods={!filters.range.from && !filters.range.to}
        />
      </section>

      {/* ─── ENTREGAS POR DIA (produtividade) ─── */}
      <section id="entregas" className="scroll-mt-20">
        <HeatmapEntregas
          obligations={obligations}
          taxes={taxes}
          installments={installments}
          services={services}
          monthKey={heatmapMonthKey}
        />
      </section>

      {/* ─── PARCELAMENTOS NO PERÍODO ─── */}
      <section id="parcelamentos" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="size-4 text-amber-600" />
                  Parcelamentos no período
                </CardTitle>
                <CardDescription className="text-xs">
                  Parcelas em ordem de vencimento
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {installmentsInPeriodTable.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma parcela no período/filtro.
              </p>
            ) : (
              <div className="overflow-auto rounded-lg border max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Parcelamento</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium text-center w-20">Parcela</th>
                      <th className="px-3 py-2 font-medium w-28">Vencimento</th>
                      <th className="px-3 py-2 font-medium w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installmentsInPeriodTable.map(({ key, inst, parcela, dueDate, effStatus }) => {
                      const client = clients.find((c) => c.id === inst.clientId)
                      return (
                        <tr
                          key={key}
                          className={`border-t hover:bg-muted/30 transition-colors ${
                            effStatus === "overdue" ? "bg-red-50/40 dark:bg-red-950/10" : ""
                          }`}
                        >
                          <td className="px-3 py-2">
                            <Link
                              href={`/parcelamentos?clientId=${inst.clientId}`}
                              className="font-medium hover:underline"
                            >
                              {inst.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{client?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums">
                            {parcela}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums">{formatDate(dueDate)}</td>
                          <td className="px-3 py-2">
                            {effStatus === "completed" ? (
                              <Badge className="bg-green-600 hover:bg-green-700 text-white">
                                <CheckCircle2 className="size-3 mr-1" /> Paga
                              </Badge>
                            ) : effStatus === "overdue" ? (
                              <Badge variant="destructive">
                                <AlertTriangle className="size-3 mr-1" /> Atrasada
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="size-3 mr-1" /> Pendente
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── POR CLIENTE ─── */}
      <section id="cliente" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens por Cliente</CardTitle>
            <CardDescription className="text-xs">
              Obrigações + guias + parcelamentos + serviços. Clique pra ver os itens do cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`space-y-3 ${showAllByClient ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
              {(showAllByClient ? byClient : byClient.slice(0, 5)).map((entry) => {
                // Breakdown por tipo, mostrando só os que têm > 0
                const typeParts: string[] = []
                if (entry.obrigCount) typeParts.push(`${entry.obrigCount} obrig.`)
                if (entry.guiaCount) typeParts.push(`${entry.guiaCount} guias`)
                if (entry.parcCount) typeParts.push(`${entry.parcCount} parc.`)
                if (entry.svcCount) typeParts.push(`${entry.svcCount} serv.`)
                return (
                  <Link
                    key={entry.clientId}
                    href={`/obrigacoes?clientId=${entry.clientId}`}
                    className="block space-y-2 p-3 rounded-lg border hover:border-primary/40 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.clientName}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {entry.total} {entry.total === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    {typeParts.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {typeParts.join(" · ")}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">{entry.completed} concluídos</Badge>
                      <Badge className="bg-blue-600 hover:bg-blue-700">{entry.inProgress} em andamento</Badge>
                      <Badge variant="secondary">{entry.pending} pendentes</Badge>
                      {entry.overdue > 0 && <Badge variant="destructive">{entry.overdue} atrasados</Badge>}
                    </div>
                    <Progress value={(entry.completed / entry.total) * 100} className="h-2" />
                  </Link>
                )
              })}
              {byClient.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item no filtro atual.
                </p>
              )}
            </div>
            {byClient.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllByClient(!showAllByClient)}
                className="w-full mt-3 text-xs"
              >
                {showAllByClient ? "Mostrar menos" : `Ver todos os ${byClient.length} clientes`}
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── POR IMPOSTO ─── */}
      <section id="imposto" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Obrigações por Tipo de Imposto</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const sortedTaxEntries = Object.entries(byTax).sort(([, a], [, b]) => b.total - a.total)
              const visibleTaxes = showAllByTax ? sortedTaxEntries : sortedTaxEntries.slice(0, 5)
              return (
                <>
                  <div className={`space-y-4 ${showAllByTax ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
                    {visibleTaxes.map(([tax, t]) => (
                      <div key={tax} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{tax}</span>
                          <span className="text-sm text-muted-foreground tabular-nums">{t.total} obrigações</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge className="bg-emerald-600 hover:bg-emerald-700">{t.completed} concluídas</Badge>
                          {t.overdue > 0 && <Badge variant="destructive">{t.overdue} atrasadas</Badge>}
                          <Badge variant="secondary">{t.total - t.completed - t.overdue} em aberto</Badge>
                        </div>
                        <Progress value={(t.completed / t.total) * 100} className="h-2" />
                      </div>
                    ))}
                    {sortedTaxEntries.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma obrigação no filtro atual.
                      </p>
                    )}
                  </div>
                  {sortedTaxEntries.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllByTax(!showAllByTax)}
                      className="w-full mt-3 text-xs"
                    >
                      {showAllByTax ? "Mostrar menos" : `Ver todos os ${sortedTaxEntries.length} impostos`}
                    </Button>
                  )}
                </>
              )
            })()}
          </CardContent>
        </Card>

        {/* Recorrência — compacto, em chips ao invés de cards grandes */}
        <Card className="mt-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por Recorrência</CardTitle>
            <CardDescription className="text-xs">Frequências usadas pelas obrigações no filtro</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(byRecurrence).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Sem dados no filtro atual.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byRecurrence)
                  .sort(([, a], [, b]) => b - a)
                  .map(([recurrence, count]) => (
                    <Badge
                      key={recurrence}
                      variant="outline"
                      className="text-xs gap-1.5 py-1 px-2.5"
                    >
                      {recurrence}
                      <span className="font-bold tabular-nums">{count}</span>
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── CONCLUÍDAS ─── */}
      <section id="concluidas" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-emerald-600" /> Itens Finalizados
            </CardTitle>
            <CardDescription className="text-xs">
              Obrigações, guias, parcelas e serviços concluídos no filtro · {" "}
              {showAllCompleted
                ? unifiedCompleted.length > 50
                  ? `50 mais recentes de ${unifiedCompleted.length}`
                  : `${unifiedCompleted.length} no filtro`
                : `${Math.min(5, unifiedCompleted.length)} mais recentes${
                    unifiedCompleted.length > 5 ? ` de ${unifiedCompleted.length}` : ""
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unifiedCompleted.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Nenhum item concluído no filtro atual.
              </p>
            ) : (
              <>
                <div className={`space-y-2 ${showAllCompleted ? "max-h-[460px] overflow-y-auto pr-1" : ""}`}>
                  {unifiedCompleted
                    .slice(0, showAllCompleted ? 50 : 5)
                    .map((item) => (
                      <Link
                        key={`${item.typeLabel}-${item.id}`}
                        href={item.href}
                        className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:border-primary/40 hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                              {item.typeLabel}
                            </Badge>
                            <span className="font-medium truncate">{item.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{item.clientName}</div>
                          {item.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              Concluído em: {formatDate(item.completedAt)}
                            </div>
                          )}
                        </div>
                        <Badge className="bg-emerald-600 mt-1 shrink-0">
                          <CheckCircle2 className="size-3 mr-1" /> Concluído
                        </Badge>
                      </Link>
                    ))}
                </div>
                {unifiedCompleted.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCompleted(!showAllCompleted)}
                    className="w-full mt-3 text-xs"
                  >
                    {showAllCompleted
                      ? "Mostrar menos"
                      : `Ver últimos ${Math.min(50, unifiedCompleted.length)}`}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
