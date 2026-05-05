// ─── Regime Tributário ───────────────────────────────────────────────────────
export type TaxRegime =
  | "simples_nacional"
  | "lucro_presumido"
  | "lucro_real"
  | "mei"
  | "imune_isento"

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
  imune_isento: "Imune / Isento",
}

export const TAX_REGIME_COLORS: Record<TaxRegime, string> = {
  simples_nacional: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  lucro_presumido: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  lucro_real: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  mei: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  imune_isento: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

// ─── Cliente ─────────────────────────────────────────────────────────────────
export type Client = {
  id: string
  name: string              // Razão social
  tradeName?: string        // Nome fantasia
  cnpj: string
  email: string
  phone: string
  status: "active" | "inactive"
  taxRegime?: TaxRegime
  businessActivity?: string // Categoria interna (servicos/comercio/industria/misto) para templates
  cnaeCode?: string         // CNAE oficial (7 dígitos) — vem da Receita
  cnaeDescription?: string  // Descrição do CNAE oficial
  ie?: string               // Inscrição Estadual
  im?: string               // Inscrição Municipal
  city?: string             // Município (vem da Receita pelo CNPJ)
  state?: string            // UF (vem da Receita pelo CNPJ)
  notes?: string
  createdAt: string
}

// ─── Imposto ──────────────────────────────────────────────────────────────────
export type TaxScope = "federal" | "estadual" | "municipal"

export const TAX_SCOPE_LABELS: Record<TaxScope, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
}

export type Tax = {
  id: string
  name: string
  /** Cliente proprietário desta guia. */
  clientId?: string
  scope?: TaxScope
  description?: string
  /** Mês-base de competência (formato "YYYY-MM"). Ex: "2026-01" = janeiro/2026. */
  competencyMonth?: string
  dueDay?: number // Dia do vencimento da guia (1-31)
  /** Mês fixo de vencimento (1-12) — só usado em guias ANUAIS com data fixa
   *  (ex: DEFIS = 3, DASN-SIMEI = 5). Quando preenchido + recurrence='annual',
   *  sobrescreve a regra padrão "mês seguinte à competência". */
  dueMonth?: number
  status: "pending" | "in_progress" | "completed" | "overdue"
  priority: Priority
  assignedTo?: string
  protocol?: string
  notes?: string
  completedAt?: string
  completedBy?: string
  history?: ObligationHistory[]
  tags?: string[]
  recurrence?: RecurrenceType
  recurrenceInterval?: number
  recurrenceEndDate?: string
  autoGenerate?: boolean
  weekendRule?: WeekendRule
  /** Regimes tributários aos quais esta guia se aplica. Vazio = aplica a todos. */
  applicableRegimes?: TaxRegime[]
  createdAt: string
  /** @deprecated Removido do formulário. Mantido apenas para compatibilidade com seeds antigos. */
  federalTaxCode?: string
  /** @deprecated Não usado mais. */
  realizationDate?: string
}

export type WeekendRule = "postpone" | "anticipate" | "keep"

export type RecurrenceType = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual" | "custom"

export type Priority = "low" | "medium" | "high" | "urgent"

export type CertificateType = "federal" | "state" | "municipal" | "fgts" | "labor"

export type Certificate = {
  id: string
  clientId: string
  type: CertificateType
  name: string
  issueDate?: string
  expiryDate: string
  status: "valid" | "expired" | "pending"
  documentNumber?: string
  notes?: string
  createdAt: string
}

export type ObligationCategory = "sped" | "tax_guide" | "certificate" | "declaration" | "other"

export type ObligationSource = "manual" | "template" | "tax"

export type Obligation = {
  id: string
  name: string
  description?: string
  category: ObligationCategory
  clientId: string
  /** Esfera da obrigação acessória. */
  scope?: TaxScope
  /** Regimes tributários aos quais esta obrigação se aplica. Vazio = aplica a todos. */
  applicableRegimes?: TaxRegime[]
  dueDay: number
  /** Mês-base de competência (formato "YYYY-MM"). Ex: "2026-01" = janeiro/2026. */
  competencyMonth?: string
  frequency: "monthly" | "quarterly" | "annual" | "custom"
  recurrence: RecurrenceType
  recurrenceInterval?: number
  recurrenceEndDate?: string
  autoGenerate: boolean
  weekendRule: WeekendRule
  status: "pending" | "in_progress" | "completed" | "overdue"
  priority: Priority
  assignedTo?: string
  protocol?: string
  notes?: string
  createdAt: string
  completedAt?: string
  completedBy?: string
  attachments?: string[]
  history?: ObligationHistory[]
  parentObligationId?: string
  generatedFor?: string
  tags?: string[]
  /** Origem da obrigação. "tax" indica que foi gerada a partir de uma guia via template. */
  source?: ObligationSource
  templateId?: string
  /** @deprecated Mantido para compatibilidade durante a migração. Não usar. */
  taxId?: string
  /** Mês fixo de vencimento (1-12), usado em obrigações ANUAIS com data
   *  fixa de entrega. Ex: DEFIS vence 31/03 do ano seguinte → dueMonth=3.
   *  Quando preenchido + recurrence='annual', sobrescreve a regra padrão
   *  de "mês seguinte à competência". */
  dueMonth?: number
  /** @deprecated Não usado mais. */
  realizationDate?: string
  /** @deprecated Não usado mais. */
  amount?: number
}

/** Registro de uma parcela individual de um parcelamento — guarda dois eventos
 *  separados: ENVIADA (você gerou a guia e mandou pro cliente) e PAGA (cliente
 *  efetivamente pagou). Antes era só "paga"; agora separamos porque é comum
 *  o contador descobrir tarde que o cliente não pagou e precisar marcar isso. */
export type PaidInstallment = {
  /** Número da parcela (1, 2, 3...). */
  number: number
  /** Quando o contador marcou como ENVIADA ao cliente (ISO string).
   *  Vazio = parcela ainda não foi enviada. */
  sentAt?: string
  /** Quem marcou como enviada (opcional). */
  sentBy?: string
  /** Quando o cliente PAGOU (ISO string). Vazio = enviada mas ainda
   *  não recebeu confirmação de pagamento. */
  paidAt?: string
  /** Quem confirmou o pagamento (opcional). */
  paidBy?: string
}

export type Installment = {
  id: string
  name: string
  description?: string
  clientId: string
  taxId?: string
  installmentCount: number
  currentInstallment: number
  dueDay: number
  firstDueDate: string
  weekendRule: WeekendRule
  status: "pending" | "in_progress" | "completed" | "overdue"
  priority: Priority
  assignedTo?: string
  protocol?: string
  notes?: string
  createdAt: string
  completedAt?: string
  completedBy?: string
  history?: ObligationHistory[]
  tags?: string[]
  autoGenerate: boolean
  recurrence: RecurrenceType
  recurrenceInterval?: number
  /** Histórico de pagamentos parcela-a-parcela. Cresce conforme o usuário
   *  marca cada parcela como paga. Vazio até a primeira ser paga. */
  paidInstallments?: PaidInstallment[]
  /** @deprecated removido. */
  realizationDate?: string
  /** @deprecated removido. */
  totalAmount?: number
  /** @deprecated removido. */
  installmentAmount?: number
  /** @deprecated removido. */
  paymentMethod?: string
  /** @deprecated removido. */
  referenceNumber?: string
}

export type ObligationHistory = {
  id: string
  action: "created" | "updated" | "completed" | "status_changed" | "comment_added"
  description: string
  timestamp: string
  user?: string
}

export type ObligationWithDetails = Obligation & {
  client: Client
  tax?: Tax
  calculatedDueDate: string
}

export type InstallmentWithDetails = Installment & {
  client: Client
  tax?: Tax
  calculatedDueDate: string
}

export type DashboardStats = {
  totalClients: number
  activeClients: number
  /** Total de itens (obrigações + guias + parcelamentos) no período selecionado. */
  totalItems: number
  /** Itens pendentes ou em andamento no período (não concluídos e não atrasados). */
  pendingItems: number
  /** Itens concluídos no período (status=completed cuja data calculada cai no período). */
  completedInPeriod: number
  /** Itens atrasados no período — usa effectiveStatus pra capturar
   *  pending/in_progress com data já vencida. */
  overdueItems: number
  /** Itens vencendo nos próximos 7 dias (a partir de hoje), dentro do período. */
  upcomingThisWeek: number
  /** Quebra por tipo, pra exibir contadores menores nos cards. */
  byType: {
    obligations: { total: number; completed: number; overdue: number; pending: number }
    taxes: { total: number; completed: number; overdue: number; pending: number }
    installments: { total: number; completed: number; overdue: number; pending: number }
  }
}

export type SavedFilter = {
  id: string
  name: string
  filters: {
    status?: string[]
    priority?: string[]
    clientId?: string
    search?: string
    dateRange?: { start: string; end: string }
  }
  createdAt: string
}

export type ExportFormat = "excel" | "pdf" | "csv"

export type ExportOptions = {
  format: ExportFormat
  includeCompleted: boolean
  dateRange?: { start: string; end: string }
  clientIds?: string[]
}

export type ProductivityMetrics = {
  totalCompleted: number
  averageCompletionTime: number // em dias
  onTimeRate: number // percentual
  byResponsible: { name: string; completed: number; onTime: number }[]
  byMonth: { month: string; completed: number; overdue: number }[]
  byPriority: { priority: Priority; count: number }[]
}
