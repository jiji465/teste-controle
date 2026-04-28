/**
 * Labels traduzidos pra exibição.
 *
 * Centralizamos aqui pra evitar duplicação entre app/impostos/page.tsx,
 * app/parcelamentos/page.tsx e components/export-dialog.tsx, que tinham
 * cada um sua cópia das mesmas funções (e divergiam em 1-2 strings).
 *
 * Use sempre essas funções pra textos visíveis ao usuário em status,
 * prioridade, regra de fim de semana, etc.
 */

/** Status de obrigação/imposto/parcelamento → texto pt-BR. */
export function statusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "Pendente"
    case "in_progress":
      return "Em andamento"
    case "completed":
      return "Concluído"
    case "overdue":
      return "Atrasado"
    default:
      return s
  }
}

/** Prioridade → texto pt-BR. */
export function priorityLabel(p: string): string {
  switch (p) {
    case "urgent":
      return "Urgente"
    case "high":
      return "Alta"
    case "medium":
      return "Média"
    case "low":
      return "Baixa"
    default:
      return p
  }
}

/** Regra de fim-de-semana / feriado → texto pt-BR. */
export function weekendRuleLabel(rule: string): string {
  switch (rule) {
    case "postpone":
      return "Postergar para o próximo dia útil"
    case "anticipate":
      return "Antecipar para o dia útil anterior"
    case "keep":
      return "Manter na data original"
    default:
      return rule
  }
}
