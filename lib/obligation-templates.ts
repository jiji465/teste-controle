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

// ─── Convenções ──────────────────────────────────────────────────────────────
// scope obrigatório em cada item (assim a esfera aparece já no template).
// weekendRule:
//   - federal       → "anticipate" (antecipa pro último dia útil anterior)
//   - estadual/municipal → "postpone" (posterga pro próximo dia útil)
// REMOVIDOS dos templates padrão (a pedido):
//   - FGTS / RAIS  → quem manda nessas é o DP, não Fiscal
//   - DIRF        → idem
//   - ECD / ECF   → não geramos via template padrão por enquanto

const COMMON_ALL: ObligationTemplate[] = [
  { name: "INSS / GPS", description: "Guia da Previdência Social", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const SIMPLES_SERVICOS: ObligationTemplate[] = [
  { name: "DAS", description: "Documento de Arrecadação do Simples Nacional", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { name: "PGDAS-D", description: "Programa Gerador do Documento de Arrecadação - Declaração", category: "declaration", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", scope: "municipal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DEFIS", description: "Declaração de Informações Socioeconômicas e Fiscais", category: "declaration", scope: "federal", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
]

const SIMPLES_COMERCIO: ObligationTemplate[] = [
  { name: "DAS", description: "Documento de Arrecadação do Simples Nacional", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { name: "PGDAS-D", description: "Programa Gerador do Documento de Arrecadação - Declaração", category: "declaration", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "DEFIS", description: "Declaração de Informações Socioeconômicas e Fiscais", category: "declaration", scope: "federal", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  { name: "ICMS-ST", description: "ICMS Substituição Tributária (se aplicável)", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "medium" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital ICMS/IPI", category: "sped", scope: "estadual", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const SIMPLES_INDUSTRIA: ObligationTemplate[] = [
  ...SIMPLES_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const PRESUMIDO_SERVICOS: ObligationTemplate[] = [
  // IRPJ/CSLL Trimestral: vence ÚLTIMO DIA ÚTIL do mês seguinte ao trimestre
  // (Lei 9.430/96 art. 5º). dueDay=31 + buildSafeDate trata cada mês corretamente
  // (abr=30, jul=31, out=31, jan=31; fev=28/29 nunca cai aqui pq 4T vai pra jan).
  // Competência é o último mês do trimestre (mar/jun/set/dez) — generateCompetencies
  // alinha automaticamente.
  { name: "IRPJ Trimestral", description: "IRPJ - Lucro Presumido (apuração trimestral, vence último dia útil do mês seguinte)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "urgent" },
  { name: "CSLL Trimestral", description: "CSLL (apuração trimestral, vence último dia útil do mês seguinte)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "high" },
  { name: "PIS", description: "Programa de Integração Social", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "COFINS", description: "Contribuição para Financiamento da Seguridade Social", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", scope: "municipal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DCTF", description: "Declaração de Débitos e Créditos Tributários Federais", category: "declaration", scope: "federal", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const PRESUMIDO_COMERCIO: ObligationTemplate[] = [
  ...PRESUMIDO_SERVICOS.filter(t => t.name !== "ISS"),
  { name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", scope: "estadual", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "EFD-Contribuições", description: "Escrituração Fiscal Digital de Contribuições", category: "sped", scope: "federal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const PRESUMIDO_INDUSTRIA: ObligationTemplate[] = [
  ...PRESUMIDO_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

// Lucro Real ainda existe no código (caso volte como template no futuro), mas
// segue as mesmas regras: sem ECD/ECF, sem FGTS/RAIS/DIRF, com scope, e
// weekendRule por esfera (federal antecipa, estadual/municipal posterga).
const REAL_SERVICOS: ObligationTemplate[] = [
  // IRPJ/CSLL Mensal (Lucro Real Estimativa): vence último dia útil do mês seguinte.
  // dueDay=31 + buildSafeDate trata fevereiro (28/29) e meses de 30 dias automaticamente.
  { name: "IRPJ Mensal (CSLL)", description: "IRPJ - Lucro Real, estimativa mensal (vence último dia útil do mês seguinte)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { name: "CSLL Mensal", description: "CSLL - estimativa mensal (vence último dia útil do mês seguinte)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "PIS Não-Cumulativo", description: "PIS regime não-cumulativo", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "COFINS Não-Cumulativo", description: "COFINS regime não-cumulativo", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "ISS", description: "Imposto Sobre Serviços", category: "tax_guide", scope: "municipal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "DCTF", description: "Declaração de Débitos e Créditos Tributários Federais", category: "declaration", scope: "federal", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  { name: "EFD-Contribuições", description: "Escrituração Fiscal Digital de Contribuições", category: "sped", scope: "federal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const REAL_COMERCIO: ObligationTemplate[] = [
  ...REAL_SERVICOS.filter(t => t.name !== "ISS"),
  { name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", scope: "estadual", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const REAL_INDUSTRIA: ObligationTemplate[] = [
  ...REAL_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

// ─── Variantes: Lucro Presumido com IRPJ/CSLL Mensal ─────────────────────────
// Para clientes que optam por antecipar os tributos mensalmente em vez de
// aguardar o fechamento trimestral.

const PRESUMIDO_MENSAL_SERVICOS: ObligationTemplate[] = [
  { name: "IRPJ Mensal", description: "IRPJ - Lucro Presumido, apuração mensal antecipada (vence último dia útil do mês seguinte)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
  { name: "CSLL Mensal", description: "CSLL - Lucro Presumido, apuração mensal antecipada (vence último dia útil do mês seguinte)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
  ...PRESUMIDO_SERVICOS.filter((t) => t.name !== "IRPJ Trimestral" && t.name !== "CSLL Trimestral"),
]

const PRESUMIDO_MENSAL_COMERCIO: ObligationTemplate[] = [
  ...PRESUMIDO_MENSAL_SERVICOS.filter((t) => t.name !== "ISS"),
  { name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", scope: "estadual", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "EFD-Contribuições", description: "Escrituração Fiscal Digital de Contribuições", category: "sped", scope: "federal", dueDay: 10, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const PRESUMIDO_MENSAL_INDUSTRIA: ObligationTemplate[] = [
  ...PRESUMIDO_MENSAL_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const PRESUMIDO_MENSAL_MISTO: ObligationTemplate[] = [
  ...PRESUMIDO_MENSAL_SERVICOS,
  ...PRESUMIDO_MENSAL_COMERCIO.filter((t) => !PRESUMIDO_MENSAL_SERVICOS.find((s) => s.name === t.name)),
]

// ─── Variantes: Lucro Real Trimestral ────────────────────────────────────────
// Algumas empresas Lucro Real optam pela apuração trimestral em vez da
// estimativa mensal. Sem ECD/ECF/LALUR/RAIS/DIRF/FGTS (tirados a pedido).

const REAL_TRIMESTRAL_SERVICOS: ObligationTemplate[] = [
  { name: "IRPJ Trimestral", description: "IRPJ - Lucro Real Trimestral (vence último dia útil do mês seguinte ao trimestre)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "urgent" },
  { name: "CSLL Trimestral", description: "CSLL - Lucro Real Trimestral (vence último dia útil do mês seguinte ao trimestre)", category: "tax_guide", scope: "federal", dueDay: 31, frequency: "quarterly", recurrence: "quarterly", weekendRule: "anticipate", priority: "high" },
  ...REAL_SERVICOS.filter((t) => t.name !== "IRPJ Mensal (CSLL)" && t.name !== "CSLL Mensal"),
]

const REAL_TRIMESTRAL_COMERCIO: ObligationTemplate[] = [
  ...REAL_TRIMESTRAL_SERVICOS.filter((t) => t.name !== "ISS"),
  { name: "ICMS", description: "Imposto sobre Circulação de Mercadorias e Serviços", category: "tax_guide", scope: "estadual", dueDay: 9, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
  { name: "SPED Fiscal (EFD ICMS/IPI)", description: "Escrituração Fiscal Digital", category: "sped", scope: "estadual", dueDay: 15, frequency: "monthly", recurrence: "monthly", weekendRule: "postpone", priority: "high" },
]

const REAL_TRIMESTRAL_INDUSTRIA: ObligationTemplate[] = [
  ...REAL_TRIMESTRAL_COMERCIO,
  { name: "IPI", description: "Imposto sobre Produtos Industrializados", category: "tax_guide", scope: "federal", dueDay: 25, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "high" },
]

const REAL_TRIMESTRAL_MISTO: ObligationTemplate[] = [
  ...REAL_TRIMESTRAL_SERVICOS,
  ...REAL_TRIMESTRAL_COMERCIO.filter((t) => !REAL_TRIMESTRAL_SERVICOS.find((s) => s.name === t.name)),
]

// ─── Mapa principal ───────────────────────────────────────────────────────────

type TemplateKey =
  | `${TaxRegime}_${BusinessActivity}`
  | `lucro_presumido_mensal_${BusinessActivity}`
  | `lucro_real_trimestral_${BusinessActivity}`

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
  // Variantes: Lucro Presumido com IRPJ/CSLL mensal (clientes que antecipam)
  lucro_presumido_mensal_servicos: [...COMMON_ALL, ...PRESUMIDO_MENSAL_SERVICOS],
  lucro_presumido_mensal_comercio: [...COMMON_ALL, ...PRESUMIDO_MENSAL_COMERCIO],
  lucro_presumido_mensal_industria: [...COMMON_ALL, ...PRESUMIDO_MENSAL_INDUSTRIA],
  lucro_presumido_mensal_misto: [...COMMON_ALL, ...PRESUMIDO_MENSAL_MISTO],
  // Variantes: Lucro Real Trimestral (em vez da estimativa mensal padrão)
  lucro_real_trimestral_servicos: [...COMMON_ALL, ...REAL_TRIMESTRAL_SERVICOS],
  lucro_real_trimestral_comercio: [...COMMON_ALL, ...REAL_TRIMESTRAL_COMERCIO],
  lucro_real_trimestral_industria: [...COMMON_ALL, ...REAL_TRIMESTRAL_INDUSTRIA],
  lucro_real_trimestral_misto: [...COMMON_ALL, ...REAL_TRIMESTRAL_MISTO],
  mei_servicos: [
    { name: "DAS-MEI", description: "Documento de Arrecadação do MEI", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
    { name: "DASN-SIMEI", description: "Declaração Anual do MEI", category: "declaration", scope: "federal", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
  ],
  mei_comercio: [
    { name: "DAS-MEI", description: "Documento de Arrecadação do MEI", category: "tax_guide", scope: "federal", dueDay: 20, frequency: "monthly", recurrence: "monthly", weekendRule: "anticipate", priority: "urgent" },
    { name: "DASN-SIMEI", description: "Declaração Anual do MEI", category: "declaration", scope: "federal", dueDay: 31, frequency: "annual", recurrence: "annual", weekendRule: "anticipate", priority: "high" },
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
  /** Última atualização. Usado pra resolver conflitos local vs remoto:
   *  na hora de mergear, a versão com updatedAt mais recente vence. */
  updatedAt?: string
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

/**
 * Salva síncrono (cache local + dispara save remoto fire-and-forget).
 * @deprecated Prefira `saveCustomTemplateAsync` em features/templates/services
 *             — ele aguarda o Supabase confirmar antes de retornar, evitando
 *             que edições sejam sobrescritas em condições de corrida.
 */
export const saveCustomTemplate = (pkg: CustomTemplatePackage): void => {
  const stamped: CustomTemplatePackage = { ...pkg, updatedAt: new Date().toISOString() }
  const templates = getCustomTemplates()
  const index = templates.findIndex((t) => t.id === stamped.id)
  if (index >= 0) {
    templates[index] = stamped
  } else {
    templates.push(stamped)
  }
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
  // Sincroniza no Supabase sem bloquear a UI
  void import("@/features/templates/services").then((m) => m.saveCustomTemplateAsync(stamped))
}

/**
 * Apaga síncrono (cache local + dispara delete remoto fire-and-forget).
 * @deprecated Prefira `deleteCustomTemplateAsync` em features/templates/services.
 */
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

// Apenas Simples Nacional + Lucro Presumido (com variante mensal).
// MEI e Lucro Real ficam disponíveis no código (TEMPLATES) mas NÃO são
// criados como templates padrão — usuário pode criar manualmente se quiser.
const DEFAULT_TEMPLATE_DEFINITIONS: SeedDef[] = [
  // ── Simples Nacional ────────────────────────────────────────────────────
  { name: "Padrão · Simples Nacional · Serviços", description: "Empresas Simples Nacional prestadoras de serviços (DAS, PGDAS-D, ISS)", key: "simples_nacional_servicos", regime: "simples_nacional", activity: "servicos" },
  { name: "Padrão · Simples Nacional · Comércio", description: "Comércio/varejo no Simples Nacional (com SPED ICMS)", key: "simples_nacional_comercio", regime: "simples_nacional", activity: "comercio" },
  { name: "Padrão · Simples Nacional · Indústria", description: "Indústria no Simples Nacional (com IPI e SPED ICMS)", key: "simples_nacional_industria", regime: "simples_nacional", activity: "industria" },
  { name: "Padrão · Simples Nacional · Misto", description: "Atividade mista (serviços + comércio) no Simples Nacional", key: "simples_nacional_misto", regime: "simples_nacional", activity: "misto" },

  // ── Lucro Presumido (trimestral) ────────────────────────────────────────
  { name: "Padrão · Lucro Presumido · Serviços", description: "Serviços no Lucro Presumido (IRPJ/CSLL trim, PIS/COFINS, ISS, DCTF)", key: "lucro_presumido_servicos", regime: "lucro_presumido", activity: "servicos" },
  { name: "Padrão · Lucro Presumido · Comércio", description: "Comércio no Lucro Presumido (com ICMS e SPED Fiscal)", key: "lucro_presumido_comercio", regime: "lucro_presumido", activity: "comercio" },
  { name: "Padrão · Lucro Presumido · Indústria", description: "Indústria no Lucro Presumido (com IPI, ICMS, SPED Fiscal)", key: "lucro_presumido_industria", regime: "lucro_presumido", activity: "industria" },
  { name: "Padrão · Lucro Presumido · Misto", description: "Atividade mista no Lucro Presumido", key: "lucro_presumido_misto", regime: "lucro_presumido", activity: "misto" },

  // ── Lucro Presumido (IRPJ/CSLL Mensal) ──────────────────────────────────
  // Para clientes que optam por antecipar IRPJ/CSLL mensalmente em vez de trimestral.
  { name: "Padrão · Lucro Presumido (IRPJ/CSLL Mensal) · Serviços", description: "Lucro Presumido com IRPJ/CSLL apurados mensalmente — serviços", key: "lucro_presumido_mensal_servicos", regime: "lucro_presumido", activity: "servicos" },
  { name: "Padrão · Lucro Presumido (IRPJ/CSLL Mensal) · Comércio", description: "Lucro Presumido com IRPJ/CSLL apurados mensalmente — comércio (com ICMS)", key: "lucro_presumido_mensal_comercio", regime: "lucro_presumido", activity: "comercio" },
  { name: "Padrão · Lucro Presumido (IRPJ/CSLL Mensal) · Indústria", description: "Lucro Presumido com IRPJ/CSLL apurados mensalmente — indústria (com IPI e ICMS)", key: "lucro_presumido_mensal_industria", regime: "lucro_presumido", activity: "industria" },
  { name: "Padrão · Lucro Presumido (IRPJ/CSLL Mensal) · Misto", description: "Lucro Presumido com IRPJ/CSLL apurados mensalmente — atividade mista", key: "lucro_presumido_mensal_misto", regime: "lucro_presumido", activity: "misto" },
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

/**
 * Cria os templates "Padrão · ..." na primeira execução do usuário.
 *
 * Comportamento:
 *  - Pula nomes que o usuário deletou explicitamente (lista negra persistida
 *    em Supabase + localStorage), pra "templates apagados não voltarem".
 *  - Pula nomes já registrados no `seeded` set, mesmo que o template tenha
 *    sido editado/renomeado.
 *  - Salva via `saveCustomTemplateAsync` (await) pra garantir persistência
 *    no Supabase antes de marcar como seeded — evita estado intermediário.
 */
// Cleanup one-shot: remove templates de MEI/Lucro Real que vieram de seeds
// antigos. Não voltam mesmo que o usuário clique em "Restaurar padrões",
// porque foram removidos de DEFAULT_TEMPLATE_DEFINITIONS.
//
// IMPORTANTE: usa LISTA EXATA dos nomes antigos (não prefixo) pra preservar
// templates manuais que o usuário possa ter criado com nome similar.
// Ex: se user criou manualmente "Padrão · MEI · Custom Empresa X", esse fica.
const MEI_REAL_CLEANUP_FLAG = "fiscal_templates_mei_real_cleanup_v2"

const LEGACY_DEFAULT_NAMES_TO_REMOVE = new Set<string>([
  // MEI (removidos do seed)
  "Padrão · MEI · Serviços",
  "Padrão · MEI · Comércio",
  // Lucro Real (removidos do seed)
  "Padrão · Lucro Real · Serviços",
  "Padrão · Lucro Real · Comércio",
  "Padrão · Lucro Real · Indústria",
  "Padrão · Lucro Real · Misto",
  // Variantes Trimestral (removidas do seed)
  "Padrão · Lucro Real Trimestral · Serviços",
  "Padrão · Lucro Real Trimestral · Comércio",
  "Padrão · Lucro Real Trimestral · Indústria",
  "Padrão · Lucro Real Trimestral · Misto",
])

async function cleanupLegacyMeiAndRealTemplates(
  allTemplates: CustomTemplatePackage[],
  deleteAsync: (id: string) => Promise<void>,
): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (localStorage.getItem(MEI_REAL_CLEANUP_FLAG) === "true") return false

  // Match EXATO. Templates manuais com prefixo similar não são afetados.
  const targets = allTemplates.filter((t) => LEGACY_DEFAULT_NAMES_TO_REMOVE.has(t.name))
  for (const t of targets) {
    try {
      await deleteAsync(t.id)
    } catch (err) {
      console.error("[templates] cleanup MEI/Real falhou:", err)
    }
  }
  // Limpa do seeded set também pra não confundir
  const seeded = loadSeededNames()
  for (const t of targets) seeded.delete(t.name)
  saveSeededNames(seeded)

  localStorage.setItem(MEI_REAL_CLEANUP_FLAG, "true")
  return targets.length > 0
}

export const seedDefaultTemplates = async (): Promise<void> => {
  if (typeof window === "undefined") return

  // 1. Carrega templates existentes (preferindo Supabase, pra evitar duplicar
  //    em outro device).
  const { getCustomTemplatesAsync, saveCustomTemplateAsync, deleteCustomTemplateAsync, getDeletedDefaultNames } =
    await import("@/features/templates/services")
  let allTemplates = await getCustomTemplatesAsync()

  // 1.5. Cleanup one-shot de MEI/Lucro Real (a pedido do usuário, não usamos por enquanto)
  const cleaned = await cleanupLegacyMeiAndRealTemplates(allTemplates, deleteCustomTemplateAsync)
  if (cleaned) allTemplates = await getCustomTemplatesAsync()

  const existingNames = new Map(allTemplates.map((p) => [p.name, p]))

  // 2. Carrega lista negra (templates padrão que o user deletou)
  const deletedDefaults = await getDeletedDefaultNames()

  const seeded = loadSeededNames()
  let changed = false

  for (const def of DEFAULT_TEMPLATE_DEFINITIONS) {
    // Não recria o que o usuário deletou
    if (deletedDefaults.has(def.name)) continue

    if (seeded.has(def.name)) {
      // Já registramos. Migra regime/activity se ainda não tem (compat com versões antigas).
      const existing = existingNames.get(def.name)
      if (existing && (!existing.regime || !existing.activity)) {
        await saveCustomTemplateAsync({ ...existing, regime: def.regime, activity: def.activity })
      }
      continue
    }
    if (existingNames.has(def.name)) {
      // Existe mas não estava no seeded — só registra
      seeded.add(def.name)
      changed = true
      continue
    }

    // Cria do zero
    const obligations = TEMPLATES[def.key] ?? COMMON_ALL
    const now = new Date().toISOString()
    await saveCustomTemplateAsync({
      id: crypto.randomUUID(),
      name: def.name,
      description: def.description,
      regime: def.regime,
      activity: def.activity,
      obligations,
      createdAt: now,
      updatedAt: now,
    })
    seeded.add(def.name)
    changed = true
  }
  if (changed) saveSeededNames(seeded)
}

/**
 * Apaga todos os templates "Padrão · ..." (no localStorage E no Supabase),
 * limpa o rastreamento de seeded_names + a lista negra de deleted defaults,
 * e re-cria os padrões via seedDefaultTemplates(). Útil para "Restaurar padrões".
 */
export const resetDefaultTemplates = async (): Promise<void> => {
  if (typeof window === "undefined") return

  const { deleteCustomTemplateAsync, clearDeletedDefaults, getCustomTemplatesAsync } = await import(
    "@/features/templates/services"
  )

  // 1. Apaga todos os "Padrão · ..." atuais (Supabase + local)
  const all = await getCustomTemplatesAsync()
  const defaults = all.filter((p) => p.name.startsWith("Padrão · "))
  await Promise.all(defaults.map((d) => deleteCustomTemplateAsync(d.id).catch(() => {})))

  // 2. Limpa lista negra (assim padrões deletados voltam) + rastreamento de seeded
  await clearDeletedDefaults()
  localStorage.removeItem(SEEDED_NAMES_KEY)

  // 3. Re-aplica o seed (cria padrões atualizados)
  await seedDefaultTemplates()
}
