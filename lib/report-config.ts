/**
 * Configuração de identidade dos relatórios exportados (Excel e PDF).
 *
 * Ponto ÚNICO para editar o nome do escritório, contato e a cor da marca.
 * Tanto o gerador de Excel (lib/report-excel.ts) quanto o de PDF
 * (lib/report-pdf.ts) leem daqui — assim os dois ficam sempre coerentes.
 *
 * Pra trocar o nome/CRC/telefone depois, basta alterar ESCRITORIO abaixo.
 */

export const ESCRITORIO = {
  /** Nome principal exibido no topo dos relatórios. */
  nome: "Sete Soluções Empresariais",
  /** Linha secundária opcional (CRC, telefone, e-mail). Vazio = não exibe. */
  linha2: "",
}

/** Cor de marca (azul) — bate com o --primary do app. Usada no cabeçalho
 *  do Excel e na faixa do PDF. */
export const BRAND = {
  /** Hex sem # (alguns usos do ExcelJS pedem ARGB). */
  hex: "2563EB",
  /** ARGB pro ExcelJS (FF = opaco). */
  argb: "FF2563EB",
  /** RGB pro jsPDF (autoTable fillColor). */
  rgb: [37, 99, 235] as [number, number, number],
  /** Cinza claro pra linhas zebradas. */
  zebraArgb: "FFF1F5F9",
  zebraRgb: [248, 250, 252] as [number, number, number],
}

/** Título padrão dos relatórios da aba Relatórios. */
export const REPORT_TITLE = "Relatório de Obrigações Fiscais"

/** Formata um intervalo de datas "YYYY-MM-DD" para um rótulo legível.
 *  Retorna "Todos os períodos" quando não há filtro. */
export function periodoLabel(from?: string | null, to?: string | null): string {
  if (!from && !to) return "Todos os períodos"
  const br = (s?: string | null) => {
    if (!s) return ""
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s
  }
  if (from && to) return `${br(from)} a ${br(to)}`
  return from ? `A partir de ${br(from)}` : `Até ${br(to)}`
}

/** Data/hora de geração no formato pt-BR. */
export function geradoEm(): string {
  return new Date().toLocaleString("pt-BR")
}
