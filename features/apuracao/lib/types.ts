// Tipos do módulo de Apuração / Relatório Executivo.
// Portado do gerador standalone (Relatorio Fiscal Mensal.html) para o app.

/** Estado do editor de uma competência (valores monetários em string "pt-BR": "12.242,00"). */
export interface ClientData {
  clientId?: string
  clientName?: string
  cnpj?: string
  compMonth?: string // "1".."12"
  compYear?: string // "2026"
  competenceShort?: string // "05/2026"
  regime?: string // "Simples Nacional" | "Lucro Presumido" | "Lucro Real"
  atividade?: string // "Serviços" | "Comércio" | "Indústria"
  anexo?: string // "Anexo I" | "Anexo III" | "Anexo V"
  revenue?: string
  rbt12?: string
  folha12m?: string
  folhaMensal?: string
  proLabore?: string
  issRate?: string
  ratRate?: string
  terceirosRate?: string
  equipHospitalar?: boolean
  ret?: Record<string, string>
  extraTaxes?: ExtraTax[]
  repartManual?: Record<string, string>
  dasOfficial?: string
  // ---- campos opcionais do design v1 (mostra se preencher) ----
  recProdutos?: string
  recServicos?: string
  recOutras?: string
  despesas?: string
  // ---- escritório / observações ----
  officeName?: string
  officePhone?: string
  officeEmail?: string
  officeCRC?: string
  officeAddress?: string
  observations?: string
}

export interface ExtraTax {
  id?: number | string
  tax: string
  base?: string
  rate?: string
  value?: string
  retido?: string
  dueDate?: string
  obs?: string
  group?: string
}

export interface TaxRow {
  tax: string
  base: string
  rate: string
  apurado: string
  retido: string
  value: string
  dueDate: string
  obs: string
  group: string
  manual?: boolean
}

export interface RepartItem {
  tax: string
  pct: number
  value: number
}

export interface SnInfo {
  rbt12: number
  folha12: number
  fatorR: number
  anexoBase: string
  anexoEf: string
  rate: number
  nominal: number
  deducao: number
  faixa: number
  das: number
  repart: RepartItem[]
}

export interface LpInfo {
  equip: boolean
  pIrpj: number
  pCsll: number
  baseIrpj: number
  baseCsll: number
  irpj: number
  adic: number
  csll: number
  issRate: number
}

export interface Economia {
  tipo: "fatorr" | "hospitalar" | "retencao" | "regime"
  titulo: string
  icon: string
  positivo: boolean
  de: number | null
  para: number | null
  valor: number
  deLabel?: string
  paraLabel?: string
  detalhe: string
  atingiu?: boolean
  fatorR?: number
  antecipacao?: boolean
}

export interface Apuracao {
  regime: string
  atividade: string
  revenue: number
  taxes: TaxRow[]
  sn: SnInfo | null
  lp: LpInfo | null
  ret: Record<string, string>
  totApurado: number
  totRetido: number
  totPagar: number
  aliqEfetiva: number
  economias: Economia[]
  economiaTributaria: number
  economiaCaixa: number
}

export type InsightLevel = "oportunidade" | "alerta" | "info" | "ok"

export interface Insight {
  nivel: InsightLevel
  icon: string
  titulo: string
  texto: string
  valor: number | null
  cliente: boolean
}

/** Ponto do histórico mensal usado no gráfico de evolução. */
export interface HistPoint {
  key: string // "AAAA-MM"
  competenceShort?: string
  faturamento: number
  tributos: number
  totPagar: number
  aliquota: number
  economia: number
}
