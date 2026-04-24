// Gera dados realistas para teste de volume:
// 30 empresas + 12 impostos + ~150 obrigações + ~18 parcelamentos.

import type { Client, Tax, Obligation, Installment, TaxRegime } from "./types"
import { getTemplateForClient, type BusinessActivity } from "./obligation-templates"

// ─── CNPJs válidos gerados algoritmicamente ─────────────────────────────────
function generateValidCNPJ(seed: number): string {
  const base = String(seed * 31 + 100000).padStart(12, "0").slice(0, 12)
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum1 = w1.reduce((acc, w, i) => acc + w * Number(base[i]), 0)
  const r1 = sum1 % 11
  const d1 = r1 < 2 ? 0 : 11 - r1
  const base13 = base + d1
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum2 = w2.reduce((acc, w, i) => acc + w * Number(base13[i]), 0)
  const r2 = sum2 % 11
  const d2 = r2 < 2 ? 0 : 11 - r2
  const full = base13 + d2
  return `${full.slice(0, 2)}.${full.slice(2, 5)}.${full.slice(5, 8)}/${full.slice(8, 12)}-${full.slice(12, 14)}`
}

type DemoCompany = {
  name: string
  tradeName: string
  taxRegime: TaxRegime
  businessActivity: BusinessActivity
  cnaeCode: string
  cnaeDescription: string
}

const DEMO_COMPANIES: DemoCompany[] = [
  // Simples Nacional - Serviços (4)
  { name: "Clínica Odontológica Bem Estar Ltda",  tradeName: "Sorriso Mais",         taxRegime: "simples_nacional", businessActivity: "servicos",  cnaeCode: "8630-5/04", cnaeDescription: "Atividade odontológica" },
  { name: "Marques & Silva Advogados Associados", tradeName: "Marques Advocacia",   taxRegime: "simples_nacional", businessActivity: "servicos",  cnaeCode: "6911-7/01", cnaeDescription: "Serviços advocatícios" },
  { name: "Pereira Tecnologia da Informação ME",  tradeName: "Pereira Tech",        taxRegime: "simples_nacional", businessActivity: "servicos",  cnaeCode: "6201-5/01", cnaeDescription: "Desenvolvimento de software" },
  { name: "Salão Belíssima Beleza Ltda ME",       tradeName: "Belíssima Salão",     taxRegime: "simples_nacional", businessActivity: "servicos",  cnaeCode: "9602-5/01", cnaeDescription: "Cabeleireiros e tratamento de beleza" },
  // Simples Nacional - Comércio (4)
  { name: "Mercadinho Central Ltda",              tradeName: "Mercadinho Central",  taxRegime: "simples_nacional", businessActivity: "comercio",  cnaeCode: "4711-3/02", cnaeDescription: "Minimercado" },
  { name: "Papelaria Boa Escrita Comércio Ltda",  tradeName: "Boa Escrita",         taxRegime: "simples_nacional", businessActivity: "comercio",  cnaeCode: "4761-0/03", cnaeDescription: "Papelaria" },
  { name: "Distribuidora Norte Bebidas Ltda",     tradeName: "Norte Bebidas",       taxRegime: "simples_nacional", businessActivity: "comercio",  cnaeCode: "4635-4/02", cnaeDescription: "Comércio atacadista de cerveja" },
  { name: "Loja Esportiva Atletas EPP",           tradeName: "Atletas Sport",       taxRegime: "simples_nacional", businessActivity: "comercio",  cnaeCode: "4763-6/02", cnaeDescription: "Comércio de artigos esportivos" },
  // Simples Nacional - Indústria (2)
  { name: "Fábrica de Doces Doce Lar Ltda",       tradeName: "Doce Lar",            taxRegime: "simples_nacional", businessActivity: "industria", cnaeCode: "1093-7/02", cnaeDescription: "Fabricação de doces" },
  { name: "Móveis Carpinaria Norte Ltda",         tradeName: "Carpinaria Norte",    taxRegime: "simples_nacional", businessActivity: "industria", cnaeCode: "3101-2/00", cnaeDescription: "Fabricação de móveis com madeira" },
  // Simples Nacional - Misto (2)
  { name: "Farmácia Saúde Total EPP",             tradeName: "Saúde Total",         taxRegime: "simples_nacional", businessActivity: "misto",     cnaeCode: "4771-7/01", cnaeDescription: "Comércio de produtos farmacêuticos" },
  { name: "Pet Shop Amigos do Bicho Ltda ME",     tradeName: "Amigos do Bicho",     taxRegime: "simples_nacional", businessActivity: "misto",     cnaeCode: "4789-0/04", cnaeDescription: "Comércio varejista de pets" },
  // Lucro Presumido - Serviços (4)
  { name: "Construtora Alicerce Engenharia Ltda", tradeName: "Alicerce",            taxRegime: "lucro_presumido",  businessActivity: "servicos",  cnaeCode: "4120-4/00", cnaeDescription: "Construção de edifícios" },
  { name: "Hospital São Lucas S.A.",              tradeName: "Hospital São Lucas",  taxRegime: "lucro_presumido",  businessActivity: "servicos",  cnaeCode: "8610-1/01", cnaeDescription: "Atividades de hospitais privados" },
  { name: "Transportadora Veloz Cargas Ltda",     tradeName: "Veloz Cargas",        taxRegime: "lucro_presumido",  businessActivity: "servicos",  cnaeCode: "4930-2/02", cnaeDescription: "Transporte rodoviário de carga" },
  { name: "Consultoria Estratégica Brasil Ltda",  tradeName: "Estratégica BR",      taxRegime: "lucro_presumido",  businessActivity: "servicos",  cnaeCode: "7020-4/00", cnaeDescription: "Consultoria em gestão empresarial" },
  // Lucro Presumido - Comércio (3)
  { name: "Atacadão Família Ltda",                tradeName: "Atacadão Família",    taxRegime: "lucro_presumido",  businessActivity: "comercio",  cnaeCode: "4639-7/01", cnaeDescription: "Comércio atacadista de produtos alimentícios" },
  { name: "Auto Peças Brasil Ltda",               tradeName: "Auto Peças BR",       taxRegime: "lucro_presumido",  businessActivity: "comercio",  cnaeCode: "4530-7/01", cnaeDescription: "Comércio por atacado de peças e acessórios para veículos" },
  { name: "Materiais de Construção Pedra Ltda",   tradeName: "Pedra Materiais",     taxRegime: "lucro_presumido",  businessActivity: "comercio",  cnaeCode: "4744-0/01", cnaeDescription: "Comércio varejista de ferragens e ferramentas" },
  // Lucro Presumido - Indústria (1)
  { name: "Indústria Têxtil Algodão Sul Ltda",    tradeName: "Algodão Sul",         taxRegime: "lucro_presumido",  businessActivity: "industria", cnaeCode: "1322-7/00", cnaeDescription: "Tecelagem de fios de algodão" },
  // Lucro Real - Serviços (2)
  { name: "Banco Investimento Confiança S.A.",    tradeName: "Confiança Bank",      taxRegime: "lucro_real",       businessActivity: "servicos",  cnaeCode: "6422-1/00", cnaeDescription: "Bancos múltiplos com carteira comercial" },
  { name: "Tecnologia Avançada Software S.A.",    tradeName: "TechAv Software",     taxRegime: "lucro_real",       businessActivity: "servicos",  cnaeCode: "6203-1/00", cnaeDescription: "Desenvolvimento e licenciamento de software" },
  // Lucro Real - Comércio (2)
  { name: "Rede de Supermercados Família S.A.",   tradeName: "Família Super",       taxRegime: "lucro_real",       businessActivity: "comercio",  cnaeCode: "4711-3/01", cnaeDescription: "Comércio varejista — hipermercados" },
  { name: "Distribuidora Nacional Plásticos Ltda",tradeName: "Nacional Plásticos",  taxRegime: "lucro_real",       businessActivity: "comercio",  cnaeCode: "4684-2/02", cnaeDescription: "Comércio atacadista de resinas e elastômeros" },
  // Lucro Real - Indústria (2)
  { name: "Aço Forte Indústria Metalúrgica S.A.", tradeName: "Aço Forte",           taxRegime: "lucro_real",       businessActivity: "industria", cnaeCode: "2511-0/00", cnaeDescription: "Fabricação de estruturas metálicas" },
  { name: "Indústria Química Brasil S.A.",        tradeName: "QuimBrasil",          taxRegime: "lucro_real",       businessActivity: "industria", cnaeCode: "2029-1/00", cnaeDescription: "Fabricação de produtos químicos" },
  // MEI (3)
  { name: "João Silva Eletricista MEI",           tradeName: "Eletricista João",    taxRegime: "mei",              businessActivity: "servicos",  cnaeCode: "4321-5/00", cnaeDescription: "Instalação e manutenção elétrica" },
  { name: "Maria Costa Costureira MEI",           tradeName: "Costura Maria",       taxRegime: "mei",              businessActivity: "servicos",  cnaeCode: "1412-6/02", cnaeDescription: "Confecção sob medida" },
  { name: "Pedro Santos Encanador MEI",           tradeName: "Encanador Pedro",     taxRegime: "mei",              businessActivity: "servicos",  cnaeCode: "4322-3/02", cnaeDescription: "Instalação e manutenção de sistemas hidráulicos" },
  // Imune/Isento (1)
  { name: "Instituto Educacional Esperança",      tradeName: "Esperança",           taxRegime: "imune_isento",     businessActivity: "servicos",  cnaeCode: "8513-9/00", cnaeDescription: "Ensino fundamental" },
]

const RESPONSAVEIS = ["Ana Costa", "Bruno Lima", "Carla Mendes", "Daniel Silva", "Elaine Rocha", "Felipe Souza"]

const STATUS_DISTRIBUTION: Array<Obligation["status"]> = [
  "pending", "pending", "pending", "pending", "pending", "pending",
  "in_progress", "in_progress", "in_progress",
  "completed",
]

const pick = <T,>(arr: T[], idx: number): T => arr[idx % arr.length]

const STORAGE_KEYS = {
  CLIENTS: "fiscal_clients",
  TAXES: "fiscal_taxes",
  OBLIGATIONS: "fiscal_obligations",
  INSTALLMENTS: "fiscal_installments",
}

const DEMO_FLAG_KEY = "fiscal_demo_data_v1"

const monthYearString = (offsetMonths: number): string => {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const isoOffset = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildClient(c: DemoCompany, index: number): Client {
  return {
    id: crypto.randomUUID(),
    name: c.name,
    tradeName: c.tradeName,
    cnpj: generateValidCNPJ(index + 1),
    email: `contato@${c.tradeName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.br`,
    phone: `(11) 9${String(80000000 + index * 137).slice(0, 8)}`,
    status: index % 9 === 8 ? "inactive" : "active",
    taxRegime: c.taxRegime,
    businessActivity: c.businessActivity,
    cnaeCode: c.cnaeCode,
    cnaeDescription: c.cnaeDescription,
    createdAt: isoOffset(-180 + index * 3),
  }
}

function buildTaxes(): Tax[] {
  const now = new Date().toISOString()
  return [
    { id: crypto.randomUUID(), name: "DAS",     scope: "federal",   description: "Documento de Arrecadação do Simples Nacional", federalTaxCode: "1234", dueDay: 20, status: "pending", priority: "urgent", recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["simples_nacional"], createdAt: now },
    { id: crypto.randomUUID(), name: "DAS-MEI", scope: "federal",   description: "Documento de Arrecadação do MEI",              federalTaxCode: "1234", dueDay: 20, status: "pending", priority: "urgent", recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["mei"],              createdAt: now },
    { id: crypto.randomUUID(), name: "ISS",     scope: "municipal", description: "Imposto Sobre Serviços",                       federalTaxCode: "",     dueDay: 10, status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["simples_nacional", "lucro_presumido", "lucro_real"], createdAt: now },
    { id: crypto.randomUUID(), name: "ICMS",    scope: "estadual",  description: "Imposto sobre Circulação de Mercadorias",      federalTaxCode: "",     dueDay: 9,  status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["lucro_presumido", "lucro_real"],                     createdAt: now },
    { id: crypto.randomUUID(), name: "IRPJ",    scope: "federal",   description: "Imposto de Renda Pessoa Jurídica",             federalTaxCode: "2089", dueDay: 30, status: "pending", priority: "urgent", recurrence: "quarterly", weekendRule: "anticipate", autoGenerate: true, applicableRegimes: ["lucro_presumido", "lucro_real"],                     createdAt: now },
    { id: crypto.randomUUID(), name: "CSLL",    scope: "federal",   description: "Contribuição Social sobre Lucro Líquido",      federalTaxCode: "2484", dueDay: 30, status: "pending", priority: "high",   recurrence: "quarterly", weekendRule: "anticipate", autoGenerate: true, applicableRegimes: ["lucro_presumido", "lucro_real"],                     createdAt: now },
    { id: crypto.randomUUID(), name: "PIS",     scope: "federal",   description: "Programa de Integração Social",                federalTaxCode: "8109", dueDay: 25, status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["lucro_presumido", "lucro_real"],                     createdAt: now },
    { id: crypto.randomUUID(), name: "COFINS",  scope: "federal",   description: "Contribuição p/ Financiamento da Seguridade",  federalTaxCode: "2172", dueDay: 25, status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["lucro_presumido", "lucro_real"],                     createdAt: now },
    { id: crypto.randomUUID(), name: "INSS",    scope: "federal",   description: "Guia da Previdência Social",                   federalTaxCode: "2100", dueDay: 20, status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: [],                                                    createdAt: now },
    { id: crypto.randomUUID(), name: "FGTS",    scope: "federal",   description: "Fundo de Garantia do Tempo de Serviço",        federalTaxCode: "",     dueDay: 7,  status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: [],                                                    createdAt: now },
    { id: crypto.randomUUID(), name: "IPI",     scope: "federal",   description: "Imposto sobre Produtos Industrializados",      federalTaxCode: "5123", dueDay: 25, status: "pending", priority: "high",   recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: ["lucro_presumido", "lucro_real"],                     createdAt: now },
    { id: crypto.randomUUID(), name: "IRRF",    scope: "federal",   description: "Imposto de Renda Retido na Fonte",             federalTaxCode: "0561", dueDay: 20, status: "pending", priority: "medium", recurrence: "monthly",   weekendRule: "postpone", autoGenerate: true,  applicableRegimes: [],                                                    createdAt: now },
  ]
}

function buildObligationsForClient(client: Client, index: number): Obligation[] {
  const templates = getTemplateForClient(client.taxRegime!, client.businessActivity as BusinessActivity)
  // Pega 4-7 obrigações do template
  const count = 4 + (index % 4)
  const subset = templates.slice(0, Math.min(count, templates.length))

  return subset.map((t, i) => {
    const status = pick(STATUS_DISTRIBUTION, index * 7 + i)
    const competencyMonth = monthYearString(-(i % 3))
    const completed = status === "completed"
    return {
      id: crypto.randomUUID(),
      name: t.name,
      description: t.description,
      category: t.category,
      clientId: client.id,
      dueDay: t.dueDay,
      competencyMonth,
      frequency: t.frequency,
      recurrence: t.recurrence,
      weekendRule: t.weekendRule,
      autoGenerate: true,
      status,
      priority: t.priority,
      assignedTo: pick(RESPONSAVEIS, index + i),
      source: "template",
      createdAt: isoOffset(-90 + i * 5),
      completedAt: completed ? isoOffset(-(i % 15)) : undefined,
      completedBy: completed ? pick(RESPONSAVEIS, index + i) : undefined,
      history: [],
      tags: [],
    }
  })
}

function buildInstallmentsFor(clients: Client[]): Installment[] {
  // ~60% dos clientes ganham 1 parcelamento
  return clients
    .filter((_, i) => i % 5 < 3)
    .map((client, i) => {
      const total = (i + 1) * 5000
      const count = 12
      const current = 1 + (i % 6)
      const status: Installment["status"] = i % 7 === 6 ? "in_progress" : "pending"
      return {
        id: crypto.randomUUID(),
        name: `Parcelamento ${["INSS", "FGTS", "ICMS", "PIS/COFINS", "IRPJ"][i % 5]} — ${client.tradeName ?? client.name}`,
        description: "Parcelamento ordinário",
        clientId: client.id,
        installmentCount: count,
        currentInstallment: current,
        dueDay: 15,
        firstDueDate: new Date(new Date().getFullYear(), new Date().getMonth() - current + 1, 15)
          .toISOString()
          .slice(0, 10),
        weekendRule: "postpone",
        status,
        priority: i % 4 === 0 ? "high" : "medium",
        assignedTo: pick(RESPONSAVEIS, i),
        autoGenerate: true,
        recurrence: "monthly",
        totalAmount: total,
        installmentAmount: Number((total / count).toFixed(2)),
        history: [],
        tags: [],
        createdAt: isoOffset(-60 + i * 3),
      }
    })
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function seedDemoData(): { clients: number; taxes: number; obligations: number; installments: number } {
  if (typeof window === "undefined") return { clients: 0, taxes: 0, obligations: 0, installments: 0 }

  const clients = DEMO_COMPANIES.map(buildClient)
  const taxes = buildTaxes()
  const obligations: Obligation[] = []
  clients.forEach((c, i) => obligations.push(...buildObligationsForClient(c, i)))
  const installments = buildInstallmentsFor(clients)

  // Mantém o que já existia (não substitui registros do usuário)
  const append = (key: string, items: unknown[]): unknown[] => {
    const existing = JSON.parse(localStorage.getItem(key) || "[]")
    return [...existing, ...items]
  }

  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(append(STORAGE_KEYS.CLIENTS, clients)))
  localStorage.setItem(STORAGE_KEYS.TAXES, JSON.stringify(append(STORAGE_KEYS.TAXES, taxes)))
  localStorage.setItem(STORAGE_KEYS.OBLIGATIONS, JSON.stringify(append(STORAGE_KEYS.OBLIGATIONS, obligations)))
  localStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(append(STORAGE_KEYS.INSTALLMENTS, installments)))
  localStorage.setItem(DEMO_FLAG_KEY, "true")

  return {
    clients: clients.length,
    taxes: taxes.length,
    obligations: obligations.length,
    installments: installments.length,
  }
}

export function clearAllData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEYS.CLIENTS)
  localStorage.removeItem(STORAGE_KEYS.TAXES)
  localStorage.removeItem(STORAGE_KEYS.OBLIGATIONS)
  localStorage.removeItem(STORAGE_KEYS.INSTALLMENTS)
  localStorage.removeItem(DEMO_FLAG_KEY)
}

export function isDemoDataLoaded(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(DEMO_FLAG_KEY) === "true"
}
