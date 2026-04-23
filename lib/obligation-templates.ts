import type { TaxRegime, ObligationCategory, RecurrenceType, WeekendRule } from "./types"

export type BusinessActivity = "servicos" | "comercio" | "industria" | "misto"

export const BUSINESS_ACTIVITY_LABELS: Record<BusinessActivity, string> = {
  servicos: "Prestação de Serviços",
  comercio: "Comércio / Varejo",
  industria: "Indústria / Fabricação",
  misto: "Serviços + Comércio (Misto)",
}

export type ObligationTemplate = {
  name: string
  description: string
  category: ObligationCategory
  dueDay: number
  frequency: "monthly" | "quarterly" | "annual" | "custom"
  recurrence: RecurrenceType
  weekendRule: WeekendRule
  priority: "low" | "medium" | "high" | "urgent"
}

// ─── Templates por regime + atividade ────────────────────────────────────────

const COMMON_ALL: ObligationTemplate[] = [
  { name: "FGTS", description: "Recolhimento mensal do FGTS", category: "tax_guide", dueDay: 7, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "INSS / GPS", description: "Guia da Previdência Social", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DIRF", description: "Declaração do Imposto de Renda Retido na Fonte", category: "declaration", dueDay: 28, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "RAIS", description: "Relação Anual de Informações Sociais", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "medium" },
]

const SIMPLES_SERVICOS: ObligationTemplate[] = [
  { name: "DAS", description: "Documento de Arrecadação do Simples Nacional", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "urgent" },
  { name: "PGDAS-D", description: "Programa Gerador do Documento de Arrecadação - Declaração", category: "declaration", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DEFIS", description: "Declaração de Informações Socioeconômicas e Fiscais", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "DASN-SIMEI", description: "Declaração Anual do Simples Nacional", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "medium" },
]

const SIMPLES_COMERCIO: ObligationTemplate[] = [
  { name: "DAS", description: "Documento de Arrecadação do Simples Nacional", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "urgent" },
  { name: "PGDAS-D", description: "Programa Gerador do Documento de Arrecadação - Declaração", category: "declaration", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DEFIS", description: "Declaração de Informações Socioeconômicas e Fiscais", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "ICMS-ST", description: "ICMS Substituição Tributária (se aplicável)", category: "tax_guide", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "medium" },
]

const SIMPLES_INDUSTRIA: ObligationTemplate[] = [
  ...SIMPLES_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const PRESUMIDO_SERVICOS: ObligationTemplate[] = [
  { name: "IRPJ Trimestral", description: "Imposto de Renda Pessoa Jurídica - Lucro Presumido", category: "tax_guide", dueDay: 30, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "urgent" },
  { name: "CSLL Trimestral", description: "Contribuição Social sobre o Lucro Líquido", category: "tax_guide", dueDay: 30, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "high" },
  { name: "PIS", description: "Programa de Integração Social", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "COFINS", description: "Contribuição para Financiamento da Seguridade Social", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DCTF", description: "Declaração de Débitos e Créditos Tributários Federais", category: "declaration", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "ECF", description: "Escrituração Contábil Fiscal", category: "sped", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "ECD", description: "Escrituração Contábil Digital", category: "sped", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
]

const PRESUMIDO_COMERCIO: ObligationTemplate[] = [
  ...PRESUMIDO_SERVICOS.filter(t => t.name !== "ISS"),
  { name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "EFD-Contribuições", description: "Escrituração Fiscal Digital de Contribuições", category: "sped", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const PRESUMIDO_INDUSTRIA: ObligationTemplate[] = [
  ...PRESUMIDO_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const REAL_SERVICOS: ObligationTemplate[] = [
  { name: "IRPJ Mensal (CSLL)", description: "Estimativa mensal IRPJ - Lucro Real", category: "tax_guide", dueDay: 30, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { name: "CSLL Mensal", description: "Contribuição Social - estimativa mensal", category: "tax_guide", dueDay: 30, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "PIS Não-Cumulativo", description: "PIS regime não-cumulativo", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "COFINS Não-Cumulativo", description: "COFINS regime não-cumulativo", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DCTF", description: "Declaração de Débitos e Créditos Tributários Federais", category: "declaration", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "EFD-Contribuições", description: "Escrituração Fiscal Digital de Contribuições", category: "sped", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "ECF", description: "Escrituração Contábil Fiscal", category: "sped", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "ECD", description: "Escrituração Contábil Digital", category: "sped", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "LALUR", description: "Livro de Apuração do Lucro Real", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "medium" },
]

const REAL_COMERCIO: ObligationTemplate[] = [
  ...REAL_SERVICOS.filter(t => t.name !== "ISS"),
  { name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const REAL_INDUSTRIA: ObligationTemplate[] = [
  ...REAL_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

// ─── Mapa principal ───────────────────────────────────────────────────────────

type TemplateKey = `${TaxRegime}_${BusinessActivity}`

const TEMPLATES: Partial<Record<TemplateKey, ObligationTemplate[]>> = {
  simples_nacional_servicos: [...COMMON_ALL, ...SIMPLES_SERVICOS],
  simples_nacional_comercio: [...COMMON_ALL, ...SIMPLES_COMERCIO],
  simples_nacional_industria: [...COMMON_ALL, ...SIMPLES_INDUSTRIA],
  simples_nacional_misto: [...COMMON_ALL, ...SIMPLES_SERVICOS, ...SIMPLES_COMERCIO.filter(t => !SIMPLES_SERVICOS.find(s => s.name === t.name))],
  lucro_presumido_servicos: [...COMMON_ALL, ...PRESUMIDO_SERVICOS],
  lucro_presumido_comercio: [...COMMON_ALL, ...PRESUMIDO_COMERCIO],
  lucro_presumido_industria: [...COMMON_ALL, ...PRESUMIDO_INDUSTRIA],
  lucro_presumido_misto: [...COMMON_ALL, ...PRESUMIDO_SERVICOS, ...PRESUMIDO_COMERCIO.filter(t => !PRESUMIDO_SERVICOS.find(s => s.name === t.name))],
  lucro_real_servicos: [...COMMON_ALL, ...REAL_SERVICOS],
  lucro_real_comercio: [...COMMON_ALL, ...REAL_COMERCIO],
  lucro_real_industria: [...COMMON_ALL, ...REAL_INDUSTRIA],
  lucro_real_misto: [...COMMON_ALL, ...REAL_SERVICOS, ...REAL_COMERCIO.filter(t => !REAL_SERVICOS.find(s => s.name === t.name))],
  mei_servicos: [
    { name: "DAS-MEI", description: "Documento de Arrecadação do MEI", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "urgent" },
    { name: "DASN-SIMEI", description: "Declaração Anual do MEI", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  ],
  mei_comercio: [
    { name: "DAS-MEI", description: "Documento de Arrecadação do MEI", category: "tax_guide", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "urgent" },
    { name: "DASN-SIMEI", description: "Declaração Anual do MEI", category: "declaration", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  ],
}

export function getTemplateForClient(regime: TaxRegime, activity: BusinessActivity): ObligationTemplate[] {
  const key: TemplateKey = `${regime}_${activity}`
  return TEMPLATES[key] ?? COMMON_ALL
}

export type CustomTemplatePackage = {
  id: string
  name: string
  description?: string
  obligations: ObligationTemplate[]
  createdAt: string
}

const CUSTOM_TEMPLATES_KEY = "fiscal_custom_templates"

export const getCustomTemplates = (): CustomTemplatePackage[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
  return data ? JSON.parse(data) : []
}

export const saveCustomTemplate = (pkg: CustomTemplatePackage): void => {
  const templates = getCustomTemplates()
  const index = templates.findIndex((t) => t.id === pkg.id)
  if (index >= 0) {
    templates[index] = pkg
  } else {
    templates.push(pkg)
  }
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
}

export const deleteCustomTemplate = (id: string): void => {
  const templates = getCustomTemplates().filter((t) => t.id !== id)
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
}
