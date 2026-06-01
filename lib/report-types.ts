/**
 * Formato ÚNICO de dados de relatório consumido tanto pelo gerador de Excel
 * (lib/report-excel.ts) quanto pelo de PDF (lib/report-pdf.ts).
 *
 * O componente de Relatórios (components/reports-panel.tsx) monta este objeto
 * a partir das listas já filtradas (não recalcula nada) e passa para os dois
 * exportadores — garantindo que Excel e PDF mostrem exatamente os mesmos
 * números, na mesma ordem.
 */

/** Bloco de contadores por tipo de tarefa. */
export type ReportTipoStats = {
  total: number
  concluidas: number
  emAndamento: number
  pendentes: number
  atrasadas: number
}

/** Indicadores de topo (resumo executivo). */
export type ReportKpis = {
  totalGeral: number
  concluidasGeral: number
  taxaConclusao: number // 0-100
  taxaNoPrazo: number // 0-100
  obrigacoes: ReportTipoStats
  guias: ReportTipoStats
  parcelas: ReportTipoStats
  servicos: ReportTipoStats
}

/** Uma linha de "Por Cliente". */
export type ReportClienteRow = {
  cliente: string
  total: number
  concluidas: number
  emAndamento: number
  pendentes: number
  atrasadas: number
  taxa: number // 0-100
  /** Nota de compliance A/B/C (vazio se não calculável). */
  nota: string
}

/** Uma linha de "Por Tipo de Imposto". */
export type ReportTipoRow = {
  nome: string
  total: number
  concluidas: number
  atrasadas: number
}

/** Uma linha de "Por Recorrência". */
export type ReportRecorrenciaRow = {
  nome: string
  quantidade: number
}

/** Uma linha do gráfico de evolução mensal. */
export type ReportEvolucaoRow = {
  mes: string
  concluidas: number
  pendentes: number
  atrasadas: number
  total: number
  taxa: number // 0-100
}

/** Uma linha de pendência (atrasada ou a vencer) — vale pros 4 tipos. */
export type ReportPendenciaRow = {
  tipo: "Obrigação" | "Guia" | "Parcela" | "Serviço"
  nome: string
  cliente: string
  /** "DD/MM/AAAA" já formatado. */
  vencimento: string
  /** Pra ordenar (epoch ms). */
  vencimentoMs: number
  prioridade: string
  competencia: string
}

/** Uma linha de item concluído (unificada dos 4 tipos). */
export type ReportConcluidaRow = {
  tipo: string
  nome: string
  cliente: string
  /** "DD/MM/AAAA" já formatado (vazio se sem data). */
  concluidaEm: string
}

/** Pacote completo entregue aos geradores. */
export type ReportData = {
  periodoLabel: string
  geradoEm: string
  kpis: ReportKpis
  porCliente: ReportClienteRow[]
  porTipo: ReportTipoRow[]
  porRecorrencia: ReportRecorrenciaRow[]
  evolucao: ReportEvolucaoRow[]
  atrasadas: ReportPendenciaRow[]
  aVencer: ReportPendenciaRow[]
  concluidas: ReportConcluidaRow[]
}
