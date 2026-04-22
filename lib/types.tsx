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
  name: string
  cnpj: string
  email: string
  phone: string
  status: "active" | "inactive"
  taxRegime?: TaxRegime
  ie?: string // Inscrição Estadual
  im?: string // Inscrição Municipal
  notes?: string
  createdAt: string
}

// ─── Imposto ──────────────────────────────────────────────────────────────────
export type Tax = {
  id: string
  name: string
  description?: string
  federalTaxCode?: string
  dueDay?: number // Dia do vencimento do imposto (1-31)
  status: "pending" | "in_progress" | "completed" | "overdue"
  priority: Priority
  assignedTo?: string
  protocol?: string
  realizationDate?: string
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
  /** Regimes tributários aos quais este imposto se aplica. Vazio = aplica a todos. */
  applicableRegimes?: TaxRegime[]
  createdAt: string
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

export type Obligation = {
  id: string
  name: string
  description?: string
  category: ObligationCategory
  clientId: string
  taxId?: string
  dueDay: number
  dueMonth?: number
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
  realizationDate?: string
  amount?: number // Valor monetário da obrigação
  notes?: string
  createdAt: string
  completedAt?: string
  completedBy?: string
  attachments?: string[]
  history?: ObligationHistory[]
  parentObligationId?: string
  generatedFor?: string
  tags?: string[]
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
  realizationDate?: string
  totalAmount?: number       // Valor total do parcelamento
  installmentAmount?: number // Valor de cada parcela (calculado)
  notes?: string
  createdAt: string
  completedAt?: string
  completedBy?: string
  history?: ObligationHistory[]
  tags?: string[]
  paymentMethod?: string
  referenceNumber?: string
  autoGenerate: boolean
  recurrence: RecurrenceType
  recurrenceInterval?: number
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
  totalObligations: number
  pendingObligations: number
  completedThisMonth: number
  overdueObligations: number
  upcomingThisWeek: number
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
