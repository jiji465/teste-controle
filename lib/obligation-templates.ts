import type { Tax, TaxRegime, TaxScope, ObligationCategory, RecurrenceType, WeekendRule } from "./types"

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
  /** Esfera tributária — preenchida quando o item representa um imposto/guia. */
  scope?: TaxScope
  dueDay: number
  frequency: "monthly" | "quarterly" | "annual" | "custom"
  recurrence: RecurrenceType
  weekendRule: WeekendRule
  priority: "low" | "medium" | "high" | "urgent"
}

/**
 * Um item selecionável no TemplateApplyDialog. Pode ser uma obrigação pura
 * (derivada de um template do sistema/custom) ou uma obrigação gerada
 * dinamicamente a partir de um Tax cadastrado. Quando sourceTaxId está
 * preenchido, o caller deve setar `taxId` + `source: "tax"` na Obligation.
 */
export type TemplateItem = ObligationTemplate & { sourceTaxId?: string }

/**
 * Filtra impostos aplicáveis ao regime tributário do cliente.
 * Se applicableRegimes estiver vazio, assume-se que o imposto se aplica a todos.
 */
export function getApplicableTaxesForClient(regime: TaxRegime, allTaxes: Tax[]): Tax[] {
  return allTaxes.filter(
    (t) =>
      !t.applicableRegimes ||
      t.applicableRegimes.length === 0 ||
      t.applicableRegimes.includes(regime),
  )
}

/**
 * Converte um Tax em um TemplateItem renderizável no dialog, marcando
 * sourceTaxId para que o caller possa vincular o taxId na Obligation gerada.
 */
export function taxToTemplateItem(tax: Tax): TemplateItem {
  return {
    name: tax.name,
    description: tax.description || `Apuração e recolhimento: ${tax.name}`,
    category: "tax_guide",
    dueDay: tax.dueDay ?? 1,
    frequency: "monthly",
    recurrence: tax.recurrence ?? "monthly",
    weekendRule: tax.weekendRule ?? "postpone",
    priority: tax.priority,
    sourceTaxId: tax.id,
  }
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
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital ICMS/IPI", category: "sped", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const SIMPLES_INDUSTRIA: ObligationTemplate[] = [
  ...SIMPLES_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
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
  /** Regime tributário ao qual este template se aplica. Quando preenchido,
   *  o sistema pré-seleciona este template ao aplicar em uma empresa do mesmo regime. */
  regime?: TaxRegime
  /** Atividade econômica. Combina com regime para matching automático. */
  activity?: BusinessActivity
  obligations: ObligationTemplate[]
  createdAt: string
}

/**
 * Encontra o template customizado que melhor combina com o regime + atividade
 * de um cliente. Prioridade:
 *   1. Match exato regime + atividade
 *   2. Match só de regime (qualquer atividade)
 *   3. null (caller decide o fallback)
 */
export function findBestTemplateMatch(
  templates: CustomTemplatePackage[],
  regime: TaxRegime | undefined,
  activity: BusinessActivity | undefined,
): CustomTemplatePackage | null {
  if (!regime) return null
  // Match exato
  const exact = templates.find((t) => t.regime === regime && t.activity === activity)
  if (exact) return exact
  // Match só de regime
  const regimeOnly = templates.find((t) => t.regime === regime && !t.activity)
  if (regimeOnly) return regimeOnly
  // Qualquer template do mesmo regime
  const anyOfRegime = templates.find((t) => t.regime === regime)
  return anyOfRegime ?? null
}

const CUSTOM_TEMPLATES_KEY = "fiscal_custom_templates"

// Persistência: localStorage (síncrono, fonte de verdade local) +
// Supabase em background via features/templates/services.ts (durabilidade
// + sync entre dispositivos). Os callers continuam usando estas funções
// síncronas; o sync remoto roda fire-and-forget.

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
  // Sincroniza no Supabase sem bloquear a UI
  void import("@/features/templates/services").then((m) => m.saveCustomTemplateAsync(pkg))
}

export const deleteCustomTemplate = (id: string): void => {
  const templates = getCustomTemplates().filter((t) => t.id !== id)
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
  void import("@/features/templates/services").then((m) => m.deleteCustomTemplateAsync(id))
}

/**
 * Duplica um template existente, gerando um novo ID e nome único ("Cópia de X").
 * Retorna o pacote criado.
 */
export const cloneCustomTemplate = (id: string): CustomTemplatePackage | null => {
  const source = getCustomTemplates().find((t) => t.id === id)
  if (!source) return null

  const existingNames = new Set(getCustomTemplates().map((t) => t.name))
  let candidate = `Cópia de ${source.name}`
  let counter = 2
  while (existingNames.has(candidate)) {
    candidate = `Cópia de ${source.name} (${counter})`
    counter++
  }

  const cloned: CustomTemplatePackage = {
    id: crypto.randomUUID(),
    name: candidate,
    description: source.description,
    obligations: source.obligations.map((o) => ({ ...o })),
    createdAt: new Date().toISOString(),
  }
  saveCustomTemplate(cloned)
  return cloned
}

// ─── Seed de templates iniciais ──────────────────────────────────────────────
// Na primeira vez que o usuário abre o sistema populamos alguns pacotes prontos
// para ele usar como ponto de partida. O usuário pode editar/apagar à vontade;
// rastreamos quais já foram oferecidos em SEEDED_NAMES_KEY para não re-criar
// os que ele apagou.

const SEEDED_NAMES_KEY = "fiscal_templates_seeded_names"
const LEGACY_SEED_FLAG_V1 = "fiscal_templates_seeded_v1"

type SeedDef = {
  name: string
  description: string
  key: TemplateKey
  regime: TaxRegime
  activity: BusinessActivity
}

// 14 combinações cobrindo todos os regimes × atividades.
// Cada template recebe regime + activity para matching automático ao
// aplicar em uma empresa nova com o mesmo perfil.
const DEFAULT_TEMPLATE_DEFINITIONS: SeedDef[] = [
  // ── Simples Nacional ────────────────────────────────────────────────────
  { name: "Padrão · Simples Nacional · Serviços", description: "Empresas Simples Nacional prestadoras de serviços (DAS, PGDAS-D, ISS)", key: "simples_nacional_servicos", regime: "simples_nacional", activity: "servicos" },
  { name: "Padrão · Simples Nacional · Comércio", description: "Comércio/varejo no Simples Nacional (com SPED ICMS)", key: "simples_nacional_comercio", regime: "simples_nacional", activity: "comercio" },
  { name: "Padrão · Simples Nacional · Indústria", description: "Indústria no Simples Nacional (com IPI e SPED ICMS)", key: "simples_nacional_industria", regime: "simples_nacional", activity: "industria" },
  { name: "Padrão · Simples Nacional · Misto", description: "Atividade mista (serviços + comércio) no Simples Nacional", key: "simples_nacional_misto", regime: "simples_nacional", activity: "misto" },

  // ── Lucro Presumido ─────────────────────────────────────────────────────
  { name: "Padrão · Lucro Presumido · Serviços", description: "Serviços no Lucro Presumido (IRPJ/CSLL trim, PIS/COFINS, ISS, DCTF)", key: "lucro_presumido_servicos", regime: "lucro_presumido", activity: "servicos" },
  { name: "Padrão · Lucro Presumido · Comércio", description: "Comércio no Lucro Presumido (com ICMS e SPED Fiscal)", key: "lucro_presumido_comercio", regime: "lucro_presumido", activity: "comercio" },
  { name: "Padrão · Lucro Presumido · Indústria", description: "Indústria no Lucro Presumido (com IPI, ICMS, SPED Fiscal)", key: "lucro_presumido_industria", regime: "lucro_presumido", activity: "industria" },
  { name: "Padrão · Lucro Presumido · Misto", description: "Atividade mista no Lucro Presumido", key: "lucro_presumido_misto", regime: "lucro_presumido", activity: "misto" },

  // ── Lucro Real ──────────────────────────────────────────────────────────
  { name: "Padrão · Lucro Real · Serviços", description: "Serviços no Lucro Real (IRPJ/CSLL mensal, PIS/COFINS não-cumulativos, EFD-Contribuições, ECF, ECD, LALUR)", key: "lucro_real_servicos", regime: "lucro_real", activity: "servicos" },
  { name: "Padrão · Lucro Real · Comércio", description: "Comércio no Lucro Real (com ICMS e SPED Fiscal)", key: "lucro_real_comercio", regime: "lucro_real", activity: "comercio" },
  { name: "Padrão · Lucro Real · Indústria", description: "Indústria no Lucro Real (com IPI, ICMS, SPED Fiscal)", key: "lucro_real_industria", regime: "lucro_real", activity: "industria" },
  { name: "Padrão · Lucro Real · Misto", description: "Atividade mista no Lucro Real", key: "lucro_real_misto", regime: "lucro_real", activity: "misto" },

  // ── MEI ─────────────────────────────────────────────────────────────────
  { name: "Padrão · MEI · Serviços", description: "Microempreendedor Individual prestador de serviços", key: "mei_servicos", regime: "mei", activity: "servicos" },
  { name: "Padrão · MEI · Comércio", description: "Microempreendedor Individual do comércio", key: "mei_comercio", regime: "mei", activity: "comercio" },
]

const loadSeededNames = (): Set<string> => {
  if (typeof window === "undefined") return new Set()
  // Migração: quem tinha a flag v1 setada já recebeu os 4 originais
  if (
    localStorage.getItem(LEGACY_SEED_FLAG_V1) === "true" &&
    !localStorage.getItem(SEEDED_NAMES_KEY)
  ) {
    const legacy = [
      "Padrão · Simples Nacional · Serviços",
      "Padrão · Simples Nacional · Comércio",
      "Padrão · Lucro Presumido · Serviços",
      "Padrão · MEI",
    ]
    localStorage.setItem(SEEDED_NAMES_KEY, JSON.stringify(legacy))
    localStorage.removeItem(LEGACY_SEED_FLAG_V1)
  }
  try {
    const raw = localStorage.getItem(SEEDED_NAMES_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

const saveSeededNames = (names: Set<string>): void => {
  if (typeof window === "undefined") return
  localStorage.setItem(SEEDED_NAMES_KEY, JSON.stringify([...names]))
}

export const seedDefaultTemplates = (): void => {
  if (typeof window === "undefined") return
  const seeded = loadSeededNames()
  const existingNames = new Map(getCustomTemplates().map((p) => [p.name, p]))
  let changed = false
  for (const def of DEFAULT_TEMPLATE_DEFINITIONS) {
    if (seeded.has(def.name)) {
      // Já criamos antes. Migra metadata regime/activity se ainda não tem.
      const existing = existingNames.get(def.name)
      if (existing && (!existing.regime || !existing.activity)) {
        saveCustomTemplate({ ...existing, regime: def.regime, activity: def.activity })
      }
      continue
    }
    if (existingNames.has(def.name)) {
      seeded.add(def.name)
      changed = true
      continue
    }
    const obligations = TEMPLATES[def.key] ?? COMMON_ALL
    saveCustomTemplate({
      id: crypto.randomUUID(),
      name: def.name,
      description: def.description,
      regime: def.regime,
      activity: def.activity,
      obligations,
      createdAt: new Date().toISOString(),
    })
    seeded.add(def.name)
    changed = true
  }
  if (changed) saveSeededNames(seeded)
}

/**
 * Apaga todos os templates com nome começando com "Padrão · " e limpa o
 * rastreamento de seeded_names, forçando a recriação pela próxima chamada
 * de seedDefaultTemplates(). Útil para o botão "Restaurar padrões".
 */
export const resetDefaultTemplates = (): void => {
  if (typeof window === "undefined") return
  const all = getCustomTemplates()
  const remaining = all.filter((p) => !p.name.startsWith("Padrão · "))
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(remaining))
  localStorage.removeItem(SEEDED_NAMES_KEY)
  seedDefaultTemplates()
}
