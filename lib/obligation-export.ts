/**
 * Exportação de Obrigações (diálogo "Exportar" de /obrigacoes) — filtros e
 * colunas extraídos de components/export-dialog.tsx pra serem testáveis.
 */
import type { ObligationWithDetails } from "./types"
import { TAX_REGIME_LABELS } from "./types"
import type { ExportColumn } from "./export-utils"
import { dateInRange } from "./date-range"
import { parseLocalDate } from "./date-utils"
import { effectiveStatus } from "./obligation-status"
import { priorityLabel, statusLabel } from "./labels"

export type ObligationExportFilters = {
  selectedClient?: string
  includeCompleted?: boolean
  /** "YYYY-MM-DD" (inclusive) */
  dateStart?: string
  /** "YYYY-MM-DD" (inclusive — o último dia entra inteiro) */
  dateEnd?: string
}

/**
 * Filtra as obrigações a exportar. As datas são comparadas por DIA de
 * calendário (dateInRange): antes `new Date("YYYY-MM-DD")` era meia-noite
 * UTC = 21h do dia anterior no Brasil, e o último dia do período ficava de
 * fora. Aceita só um dos limites.
 */
export function filterObligationsForExport(
  obligations: ObligationWithDetails[],
  f: ObligationExportFilters,
): ObligationWithDetails[] {
  const selectedClient = f.selectedClient ?? "all"
  const includeCompleted = f.includeCompleted ?? true
  let data = obligations
  if (selectedClient !== "all") data = data.filter((o) => o.clientId === selectedClient)
  if (!includeCompleted) data = data.filter((o) => o.status !== "completed")
  if (f.dateStart || f.dateEnd) {
    const range = { from: f.dateStart || null, to: f.dateEnd || null }
    data = data.filter((o) => dateInRange(o.calculatedDueDate, range))
  }
  return data
}

export const OBLIGATION_TAB_LABEL: Record<string, string> = {
  pending: "Pendentes",
  in_progress: "Em Andamento",
  completed: "Concluídas",
  overdue: "Atrasadas",
}

/**
 * Mesma regra das abas de /obrigacoes (app/obrigacoes/page.tsx): a
 * exportação respeita a aba visível (?tab=...). "all"/desconhecida = todas.
 */
export function filterObligationsByTab(obligations: ObligationWithDetails[], tab: string | null | undefined): ObligationWithDetails[] {
  switch (tab) {
    case "pending":
      return obligations.filter((o) => effectiveStatus(o) === "pending")
    case "in_progress":
      return obligations.filter((o) => o.status === "in_progress")
    case "completed":
      return obligations.filter((o) => o.status === "completed")
    case "overdue":
      return obligations.filter((o) => effectiveStatus(o) === "overdue")
    default:
      return obligations
  }
}

/** "2026-09" → "09/2026" */
function competenciaLabel(c: string | undefined): string {
  const m = c?.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[2]}/${m[1]}` : ""
}

export const OBLIGATION_EXPORT_COLUMNS: ExportColumn<ObligationWithDetails>[] = [
  { header: "Obrigação", width: 32, accessor: (o) => o.name },
  { header: "Cliente", width: 30, accessor: (o) => o.client.name },
  { header: "CNPJ", width: 18, accessor: (o) => o.client.cnpj || "" },
  { header: "Regime", width: 18, accessor: (o) => (o.client.taxRegime ? TAX_REGIME_LABELS[o.client.taxRegime] : "") },
  { header: "Competência", width: 12, accessor: (o) => competenciaLabel(o.competencyMonth) },
  { header: "Vencimento", width: 12, accessor: (o) => parseLocalDate(o.calculatedDueDate) },
  // Status EFETIVO: pendente/em andamento com vencimento passado sai "Atrasado"
  { header: "Status", width: 12, accessor: (o) => statusLabel(effectiveStatus(o)) },
  { header: "Prioridade", width: 10, accessor: (o) => priorityLabel(o.priority) },
  { header: "Concluída em", width: 14, accessor: (o) => (o.completedAt ? new Date(o.completedAt) : "") },
]
