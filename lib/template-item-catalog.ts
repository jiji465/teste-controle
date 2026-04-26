import type { ObligationTemplate } from "./obligation-templates"

/**
 * Catálogo de itens fiscais comuns pra "Adicionar em lote" dentro do form
 * de template. Cada item já vem com defaults sensatos (esfera, dia, regra
 * de fim de semana). O usuário pode editar depois se quiser.
 *
 * Convenções:
 *  - Federal       → weekendRule: anticipate
 *  - Estadual/Mun. → weekendRule: postpone
 */
export type CatalogItem = ObligationTemplate & { /** Categoria pra agrupar visualmente */ group: string }

export const TEMPLATE_ITEM_CATALOG: CatalogItem[] = [
  // ── Federais — Simples Nacional ────────────────────────────────────────────
  { group: "Simples Nacional", name: "DAS", description: "Documento de Arrecadação do Simples Nacional", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { group: "Simples Nacional", name: "PGDAS-D", description: "Programa Gerador do Documento de Arrecadação - Declaração", category: "declaration", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { group: "Simples Nacional", name: "DEFIS", description: "Declaração de Informações Socioeconômicas e Fiscais", category: "declaration", scope: "federal", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { group: "Simples Nacional", name: "DAS-MEI", description: "Documento de Arrecadação do MEI", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { group: "Simples Nacional", name: "DASN-SIMEI", description: "Declaração Anual do Simples Nacional - MEI", category: "declaration", scope: "federal", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },

  // ── Federais — Lucro Presumido / Real ──────────────────────────────────────
  // IRPJ/CSLL: vencem ÚLTIMO DIA ÚTIL do mês seguinte (Lei 9.430/96 art. 5º).
  // dueDay=31 + buildSafeDate trata fevereiro (28/29) e meses de 30 dias.
  // Trimestral: competência alinhada pro último mês do trimestre (mar/jun/set/dez).
  { group: "Lucro Presumido / Real", name: "IRPJ Trimestral", description: "IRPJ trimestral — vence último dia útil do mês seguinte ao trimestre", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "urgent" },
  { group: "Lucro Presumido / Real", name: "CSLL Trimestral", description: "CSLL trimestral — vence último dia útil do mês seguinte ao trimestre", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "high" },
  { group: "Lucro Presumido / Real", name: "IRPJ Mensal", description: "IRPJ mensal — vence último dia útil do mês seguinte", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { group: "Lucro Presumido / Real", name: "CSLL Mensal", description: "CSLL mensal — vence último dia útil do mês seguinte", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { group: "Lucro Presumido / Real", name: "PIS", description: "Programa de Integração Social", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { group: "Lucro Presumido / Real", name: "COFINS", description: "Contribuição para Financiamento da Seguridade Social", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { group: "Lucro Presumido / Real", name: "DCTF", description: "Declaração de Débitos e Créditos Tributários Federais", category: "declaration", scope: "federal", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { group: "Lucro Presumido / Real", name: "EFD-Contribuições", description: "Escrituração Fiscal Digital de Contribuições", category: "sped", scope: "federal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },

  // ── Federais — Genéricos / Industriais ─────────────────────────────────────
  { group: "Federais", name: "INSS / GPS", description: "Guia da Previdência Social", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { group: "Federais", name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },

  // ── Estaduais ──────────────────────────────────────────────────────────────
  { group: "Estaduais", name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { group: "Estaduais", name: "ICMS-ST", description: "ICMS Substituição Tributária", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "medium" },
  { group: "Estaduais", name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital ICMS/IPI", category: "sped", scope: "estadual", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },

  // ── Municipais ─────────────────────────────────────────────────────────────
  { group: "Municipais", name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", scope: "municipal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { group: "Municipais", name: "ISS Retido", description: "ISS retido na fonte", category: "tax_guide", scope: "municipal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

/** Agrupa o catálogo por `group` mantendo a ordem original. */
export function groupedCatalog(): Map<string, CatalogItem[]> {
  const map = new Map<string, CatalogItem[]>()
  for (const item of TEMPLATE_ITEM_CATALOG) {
    if (!map.has(item.group)) map.set(item.group, [])
    map.get(item.group)!.push(item)
  }
  return map
}
