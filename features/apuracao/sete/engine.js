// PDF.js é carregado sob demanda (dynamic import) dentro de extractPdfText.
// No Next.js não usamos o import "?url" do Vite — o worker é apontado para a CDN.

export const COLORS_MAP = { NAVY: "#1e3a8a", GOLD: "#C5A059", SLATE_DARK: "#334155", SLATE_MID: "#64748b" };
export const OFFICE_NAME = "SETE Soluções Empresariais";

// ===== Valores anuais — ATUALIZAR a cada virada de exercício =====
export const SALARIO_MINIMO = 1621.00;   // 2026
export const TETO_INSS = 8475.55;        // 2026 — Portaria MPS/MF nº 13/2026
export const SUBLIMITE_SN = 3600000;     // sublimite do Simples: acima, ICMS/ISS fora do DAS
export const LIMITE_SN = 4800000;        // teto do Simples Nacional

export const parseNumBR = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    return parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

export const formatCurrency = (val) => {
    const num = parseNumBR(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};
export const formatPercent = (val) => (parseNumBR(val) || 0).toFixed(2).replace('.', ',') + '%';

export const calculateTotalRevenue = (data) => {
    const isSimplesOuMei = data.regime === 'Simples Nacional' || data.regime === 'MEI';
    if (isSimplesOuMei) return parseNumBR(data.revenue);
    return parseNumBR(data.revenueRetained) + parseNumBR(data.revenueNonRetained);
};

export const formatCNPJ = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 14);
    return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
};

// Estrutura Base dos Tributos
export const DEFAULT_TAXES_LP = [
    { id: 1, tax: "PIS", base: "", rate: "0,65", apurado: "", retido: "", value: "", dueDate: "", obs: "Regime cumulativo", retidoManual: false },
    { id: 2, tax: "COFINS", base: "", rate: "3,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Regime cumulativo", retidoManual: false },
    { id: 3, tax: "ISS", base: "", rate: "5,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Imposto municipal sobre serviços", retidoManual: false },
    { id: 4, tax: "IRPJ", base: "", rate: "15,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Provisão mensal (Venc. Real Trimestral)", retidoManual: false },
    { id: 10, tax: "Adicional IRPJ", base: "", rate: "10,00", apurado: "", retido: "", value: "", dueDate: "", obs: "10% sobre a base que exceder R$ 20 mil/mês (R$ 60 mil/trim)", retidoManual: false },
    { id: 5, tax: "CSLL", base: "", rate: "9,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Provisão mensal (Venc. Real Trimestral)", retidoManual: false },
    { id: 6, tax: "CPP (Patronal)", base: "", rate: "20,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Contribuição previdenciária", retidoManual: false },
    { id: 7, tax: "RAT", base: "", rate: "1,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Risco Ambiental do Trabalho", retidoManual: false },
    { id: 8, tax: "Terceiros", base: "", rate: "5,80", apurado: "", retido: "", value: "", dueDate: "", obs: "SESC, SENAC, SEBRAE, etc.", retidoManual: false },
    { id: 9, tax: "FGTS", base: "", rate: "8,00", apurado: "", retido: "", value: "", dueDate: "", obs: "8% sobre a folha de salários", retidoManual: false },
];

// Comércio/Indústria no LP: ICMS por débito e crédito no lugar do ISS.
// Antecipação Parcial e DIFAL ficam como linhas de valor manual (nem sempre seguem alíquota).
export const DEFAULT_TAXES_LP_COMERCIO = [
    { id: 1, tax: "PIS", base: "", rate: "0,65", apurado: "", retido: "", value: "", dueDate: "", obs: "Regime cumulativo", retidoManual: false },
    { id: 2, tax: "COFINS", base: "", rate: "3,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Regime cumulativo", retidoManual: false },
    { id: 3, tax: "ICMS", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Apuração por débito e crédito", retidoManual: false },
    { id: 4, tax: "IRPJ", base: "", rate: "15,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Provisão mensal (Venc. Real Trimestral)", retidoManual: false },
    { id: 12, tax: "Adicional IRPJ", base: "", rate: "10,00", apurado: "", retido: "", value: "", dueDate: "", obs: "10% sobre a base que exceder R$ 20 mil/mês (R$ 60 mil/trim)", retidoManual: false },
    { id: 5, tax: "CSLL", base: "", rate: "9,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Provisão mensal (Venc. Real Trimestral)", retidoManual: false },
    { id: 6, tax: "CPP (Patronal)", base: "", rate: "20,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Contribuição previdenciária", retidoManual: false },
    { id: 7, tax: "RAT", base: "", rate: "1,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Risco Ambiental do Trabalho", retidoManual: false },
    { id: 8, tax: "Terceiros", base: "", rate: "5,80", apurado: "", retido: "", value: "", dueDate: "", obs: "SESC, SENAC, SEBRAE, etc.", retidoManual: false },
    { id: 9, tax: "FGTS", base: "", rate: "8,00", apurado: "", retido: "", value: "", dueDate: "", obs: "8% sobre a folha de salários", retidoManual: false },
    { id: 10, tax: "Antecipação Parcial", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Informe o valor a recolher (se houver)", retidoManual: false },
    { id: 11, tax: "DIFAL", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Informe o valor a recolher (se houver)", retidoManual: false },
];

export const lpDefaults = (atividade) => (atividade === 'Comércio' || atividade === 'Indústria') ? DEFAULT_TAXES_LP_COMERCIO : DEFAULT_TAXES_LP;

// Apuração estadual do comércio (LP/Real): ICMS por débito/crédito e FUMACOP (2% — Lei 8.205/2004, MA).
// Antecipação Parcial e DIFAL não são calculados aqui — entram como valor manual na tabela.
export const calcComercioLP = (data, totalRevenue) => {
    const entradas = parseNumBR(data.entradasCompras);
    const aliqInterna = parseNumBR(data.aliqIcmsSaida);
    const aliqERaw = parseNumBR(data.aliqIcmsEntrada);
    const aliqE = aliqERaw > 0 ? aliqERaw : aliqInterna;
    const saldoAnterior = parseNumBR(data.saldoCredorICMS);
    const baseFumacop = parseNumBR(data.baseFumacop);
    // Saídas em Substituição Tributária NÃO geram débito próprio (ICMS já recolhido antes)
    const saidasST = parseNumBR(data.saidasST);
    const baseSaidas = Math.max(0, totalRevenue - saidasST);
    // Débito/crédito TOTAIS informados (ajustes lançados em bloco, do livro de apuração/SPED)
    // prevalecem sobre o cálculo por alíquota — é como o contador costuma fechar o ICMS.
    const debManual = parseNumBR(data.icmsDebitoTotal);
    const credManual = parseNumBR(data.icmsCreditoTotal);
    const temManual = debManual > 0 || credManual > 0;

    let icms = null;
    if (totalRevenue > 0 && (aliqInterna > 0 || temManual)) {
        const debito = debManual > 0 ? debManual : baseSaidas * aliqInterna / 100;
        const credito = (credManual > 0 ? credManual : entradas * aliqE / 100) + saldoAnterior;
        icms = { debito, credito, aliqS: aliqInterna, aliqE, saldoAnterior, saidasST, baseSaidas, manual: temManual, aPagar: Math.max(0, debito - credito), saldoCredor: Math.max(0, credito - debito) };
    }
    const fumacop = baseFumacop > 0 ? baseFumacop * 0.02 : 0;
    // DIFAL e Antecipação Parcial: diferença entre a alíquota interna e a interestadual
    const aliqInter = parseNumBR(data.aliqInterestadual) > 0 ? parseNumBR(data.aliqInterestadual) : 12;
    const difalRate = Math.max(0, aliqInterna - aliqInter);
    const baseDifal = parseNumBR(data.baseDifal);
    const baseAntec = parseNumBR(data.baseAntecipacao);
    const difal = baseDifal > 0 && difalRate > 0 ? baseDifal * difalRate / 100 : 0;
    const antecipacao = baseAntec > 0 && difalRate > 0 ? baseAntec * difalRate / 100 : 0;
    return { icms, fumacop, entradas, baseFumacop, aliqInterna, aliqInter, difalRate, difal, antecipacao };
};

export const DEFAULT_TAXES_SN_SERVICOS = [
    { id: 1, tax: "DAS", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Documento de Arrecadação do Simples", retidoManual: false },
    { id: 2, tax: "ISS (retido)", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "ISS retido na fonte, se aplicável", retidoManual: false },
    { id: 3, tax: "INSS (Sócio)", base: "", rate: "11,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Retenção sobre Pró-labore", retidoManual: false },
];

export const DEFAULT_TAXES_SN_COMERCIO = [
    { id: 1, tax: "DAS", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Documento de Arrecadação do Simples", retidoManual: false },
    { id: 2, tax: "ICMS (ST)", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Substituição tributária, se aplicável", retidoManual: false },
    { id: 3, tax: "DIFAL", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Diferencial de alíquota, se aplicável", retidoManual: false },
];

// DAS-MEI = 5% do salário-mínimo (INSS) + ICMS R$ 1,00 e/ou ISS R$ 5,00 (fixos por lei)
const INSS_MEI = SALARIO_MINIMO * 0.05;
const fmtMEI = (n) => n.toFixed(2).replace('.', ',');
export const DEFAULT_TAXES_MEI_COMERCIO = [ { id: 1, tax: "DAS-MEI", base: "", rate: "", apurado: fmtMEI(INSS_MEI + 1), retido: "", value: fmtMEI(INSS_MEI + 1), dueDate: "", obs: `INSS R$ ${fmtMEI(INSS_MEI)} + ICMS R$ 1,00`, retidoManual: false } ];
export const DEFAULT_TAXES_MEI_SERVICOS = [ { id: 1, tax: "DAS-MEI", base: "", rate: "", apurado: fmtMEI(INSS_MEI + 5), retido: "", value: fmtMEI(INSS_MEI + 5), dueDate: "", obs: `INSS R$ ${fmtMEI(INSS_MEI)} + ISS R$ 5,00`, retidoManual: false } ];
export const DEFAULT_TAXES_MEI_AMBOS = [ { id: 1, tax: "DAS-MEI", base: "", rate: "", apurado: fmtMEI(INSS_MEI + 6), retido: "", value: fmtMEI(INSS_MEI + 6), dueDate: "", obs: `INSS R$ ${fmtMEI(INSS_MEI)} + ICMS R$ 1,00 + ISS R$ 5,00`, retidoManual: false } ];

export const DEFAULT_TAXES = DEFAULT_TAXES_LP;

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const GLOSSARY = [
    { acronym: "IRPJ", full: "Imposto de Renda Pessoa Jurídica", icon: "Landmark", matchTaxes: ["IRPJ", "Adicional IRPJ"], desc: "Imposto federal sobre o lucro da empresa. O vencimento oficial do DARF ocorre trimestralmente." },
    { acronym: "IRRF", full: "Imposto de Renda Retido na Fonte", icon: "Receipt", matchTaxes: ["IRRF"], desc: "Imposto de renda retido sobre o pró-labore do sócio pela tabela progressiva mensal (base = pró-labore − INSS). Em 2026, rendimentos até R$ 5.000 são isentos (Lei 15.270/2025)." },
    { acronym: "CSLL", full: "Contribuição Social sobre o Lucro Líquido", icon: "Building2", matchTaxes: ["CSLL"], desc: "Contribuição que financia a seguridade social. Vencimento oficial trimestral no Lucro Presumido/Real." },
    { acronym: "ISS", full: "Imposto Sobre Serviços", icon: "Receipt", matchTaxes: ["ISS", "ISS (retido)"], desc: "Imposto de competência municipal, cobrado sobre a prestação de serviços." },
    { acronym: "PIS/COFINS", full: "Programa de Integração Social / COFINS", icon: "BadgePercent", matchTaxes: ["PIS", "COFINS", "PIS/COFINS"], desc: "Contribuições federais incidentes sobre faturamento bruto." },
    { acronym: "CPP", full: "Contribuição Previdenciária Patronal", icon: "Scale", matchTaxes: ["CPP", "CPP (Patronal)"], desc: "Encargo patronal de 20% sobre o montante da folha de salários e do pró-labore." },
    { acronym: "RAT", full: "Riscos Ambientais do Trabalho", icon: "Scale", matchTaxes: ["RAT", "RAT (Ajustado)"], desc: "Contribuição previdenciária patronal para financiamento de aposentadoria especial e benefícios por acidentes." },
    { acronym: "Terceiros", full: "Outras Entidades e Fundos", icon: "Building2", matchTaxes: ["Terceiros"], desc: "Contribuição destinada a outras entidades e fundos (Sistema S: SESC, SENAC, SEBRAE, etc.)." },
    { acronym: "INSS (Sócio)", full: "Contribuição do Segurado", icon: "Scale", matchTaxes: ["INSS (Sócio)"], desc: "Retenção previdenciária de 11% obrigatória sobre a retirada de pró-labore do sócio." },
    { acronym: "INSS (Retenção)", full: "Retenção Previdenciária", icon: "Receipt", matchTaxes: ["INSS (retido)"], desc: "Retenção de INSS na fonte referente à prestação de serviços." },
    { acronym: "FGTS", full: "Fundo de Garantia do Tempo de Serviço", icon: "Landmark", matchTaxes: ["FGTS"], desc: "Depósito equivalente a 8% da remuneração de cada trabalhador na folha de salários." },
    { acronym: "DAS", full: "Documento de Arrecadação do Simples Nacional", icon: "Receipt", matchTaxes: ["DAS", "DAS-MEI"], desc: "Guia única de recolhimento do Simples Nacional que unifica diversos tributos em uma alíquota." },
    { acronym: "ICMS", full: "Imposto sobre Circulação de Mercadorias e Serviços", icon: "Receipt", matchTaxes: ["ICMS", "ICMS (ST)"], desc: "Imposto estadual sobre a circulação de mercadorias, apurado pelo confronto entre débitos (saídas) e créditos (entradas)." },
    { acronym: "Antecipação Parcial", full: "ICMS antecipado nas compras interestaduais", icon: "Receipt", matchTaxes: ["Antecipação Parcial"], desc: "Diferença entre a alíquota interna e a interestadual, recolhida antecipadamente sobre o valor das mercadorias compradas de outros estados para revenda." },
    { acronym: "DIFAL", full: "Diferencial de Alíquotas", icon: "Receipt", matchTaxes: ["DIFAL"], desc: "Diferença entre a alíquota interna e a interestadual sobre compras de outros estados destinadas a uso, consumo ou ativo imobilizado." },
    { acronym: "FUMACOP", full: "Fundo Maranhense de Combate à Pobreza", icon: "Landmark", matchTaxes: ["FUMACOP"], desc: "Adicional de 2 pontos percentuais de ICMS sobre produtos da Lei 8.205/2004 (MA), recolhido em guia própria." },
];

export const SN_TABLES = {
    'Anexo I': [ { limit: 180000, rate: 4.00, deduction: 0 }, { limit: 360000, rate: 7.30, deduction: 5940 }, { limit: 720000, rate: 9.50, deduction: 13860 }, { limit: 1800000, rate: 10.70, deduction: 22500 }, { limit: 3600000, rate: 14.30, deduction: 87300 }, { limit: 4800000, rate: 19.00, deduction: 378000 } ],
    'Anexo II': [ { limit: 180000, rate: 4.50, deduction: 0 }, { limit: 360000, rate: 7.80, deduction: 5940 }, { limit: 720000, rate: 10.00, deduction: 13860 }, { limit: 1800000, rate: 11.20, deduction: 22500 }, { limit: 3600000, rate: 14.70, deduction: 85500 }, { limit: 4800000, rate: 30.00, deduction: 720000 } ],
    'Anexo III': [ { limit: 180000, rate: 6.00, deduction: 0 }, { limit: 360000, rate: 11.20, deduction: 9360 }, { limit: 720000, rate: 13.50, deduction: 17640 }, { limit: 1800000, rate: 16.00, deduction: 35640 }, { limit: 3600000, rate: 21.00, deduction: 125640 }, { limit: 4800000, rate: 33.00, deduction: 648000 } ],
    'Anexo IV': [ { limit: 180000, rate: 4.50, deduction: 0 }, { limit: 360000, rate: 9.00, deduction: 8100 }, { limit: 720000, rate: 10.20, deduction: 12420 }, { limit: 1800000, rate: 14.00, deduction: 39780 }, { limit: 3600000, rate: 22.00, deduction: 183780 }, { limit: 4800000, rate: 33.00, deduction: 828000 } ],
    'Anexo V': [ { limit: 180000, rate: 15.50, deduction: 0 }, { limit: 360000, rate: 18.00, deduction: 4500 }, { limit: 720000, rate: 19.50, deduction: 9900 }, { limit: 1800000, rate: 20.50, deduction: 17100 }, { limit: 3600000, rate: 23.00, deduction: 62100 }, { limit: 4800000, rate: 30.50, deduction: 540000 } ],
};

export const calcAliquotaEfetivaSN = (rbt12, anexo) => {
    const table = SN_TABLES[anexo];
    if (!table || rbt12 <= 0) return { rate: 0, nominal: 0, deduction: 0, faixa: 0 };
    const faixa = table.find(f => rbt12 <= f.limit) || table[table.length - 1];
    const faixaIdx = table.indexOf(faixa) + 1;
    const effective = ((rbt12 * (faixa.rate / 100)) - faixa.deduction) / rbt12 * 100;
    return { rate: Math.max(effective, 0), nominal: faixa.rate, deduction: faixa.deduction, faixa: faixaIdx };
};

export const calcFatorR = (folha12m, rbt12) => {
    if (!rbt12 || rbt12 <= 0) return 0;
    return (folha12m / rbt12) * 100;
};

// A migração Anexo III ↔ V pelo Fator R só vale para atividades sujeitas a ele (LC 123, art. 18, §5º-I/J).
// Atividades que são Anexo III por natureza (ex.: contabilidade, escolas) não migram.
export const getAnexoEfetivo = (anexo, fatorR, sujeitoFatorR = true) => {
    if (!sujeitoFatorR) return anexo;
    if (anexo === 'Anexo V' && fatorR >= 28) return 'Anexo III';
    if (anexo === 'Anexo III' && fatorR < 28) return 'Anexo V';
    return anexo;
};

// Sem flag explícita, deriva: Anexo V implica atividade de Fator R; Anexo III só se há folha informada
// (preserva o comportamento de rascunhos antigos, que não têm o campo sujeitoFatorR).
export const isSujeitoFatorR = (data, folha12m) =>
    data.sujeitoFatorR !== undefined ? !!data.sujeitoFatorR : (data.anexo === 'Anexo V' || (folha12m || 0) > 0);

// ===== IRRF sobre o pró-labore (tabela progressiva mensal) =====
// Tabela 2026 (faixas mantidas de 2025) + redutor mensal da Lei 15.270/2025
// (vigente desde jan/2026): rendimento até R$ 5.000 fica isento e há redução
// parcial e decrescente entre R$ 5.000,01 e R$ 7.350. Base = pró-labore − INSS.
export const IRRF_DEPENDENTE = 189.59;
export const IRRF_TABLE = [
    { limit: 2259.20, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 7.5, deduction: 169.44 },
    { limit: 3751.05, rate: 15, deduction: 381.44 },
    { limit: 4664.68, rate: 22.5, deduction: 662.77 },
    { limit: Infinity, rate: 27.5, deduction: 896.00 },
];
export const calcIRRFProLabore = (proLabore, inss) => {
    const pl = parseNumBR(proLabore);
    if (pl <= 0) return { base: 0, imposto: 0, aliquota: 0, isento: false };
    const base = Math.max(0, pl - parseNumBR(inss));
    const faixa = IRRF_TABLE.find(f => base <= f.limit) || IRRF_TABLE[IRRF_TABLE.length - 1];
    let imposto = Math.max(0, base * faixa.rate / 100 - faixa.deduction);
    let isento = false;
    // Redutor mensal — Lei 15.270/2025 (isenção até R$ 5.000; redução parcial até R$ 7.350)
    if (pl <= 5000) { imposto = 0; isento = true; }
    else if (pl <= 7350) { imposto = Math.max(0, imposto - Math.max(0, 978.62 - 0.133145 * pl)); }
    return { base, imposto, aliquota: faixa.rate, isento };
};

// Lista de pró-labores: usa data.socios [{nome,valor}] quando houver; senão o campo único.
// INSS (teto) e IRRF (tabela) são individuais por sócio, então precisam ser somados, não agregados.
export const getProLabores = (data) => {
    if (Array.isArray(data.socios) && data.socios.length) {
        return data.socios.map(s => parseNumBR(s.valor)).filter(v => v > 0);
    }
    const pl = parseNumBR(data.proLabore);
    return pl > 0 ? [pl] : [];
};
export const sumProLabore = (data) => getProLabores(data).reduce((s, v) => s + v, 0);

export const FERIADOS_NACIONAIS = ['01/01', '21/04', '01/05', '07/09', '12/10', '02/11', '15/11', '20/11', '25/12']; // feriados nacionais fixos
const pad2 = (n) => String(n).padStart(2, '0');

// Feriados móveis (bancários) por ano, a partir do domingo de Páscoa (algoritmo de Meeus).
// Sexta-feira Santa (−2), Carnaval segunda (−48) e terça (−47), Corpus Christi (+60).
const computeEaster = (year) => {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const mm = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * mm + 114) / 31);
    const day = ((h + l - 7 * mm + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};
const _feriadosMoveisCache = {};
export const feriadosMoveis = (year) => {
    if (_feriadosMoveisCache[year]) return _feriadosMoveisCache[year];
    const easter = computeEaster(year);
    const set = new Set([-2, -47, -48, 60].map((off) => {
        const d = new Date(easter); d.setDate(easter.getDate() + off);
        return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
    }));
    _feriadosMoveisCache[year] = set;
    return set;
};

const isDiaUtil = (d) => {
    if (d.getDay() === 0 || d.getDay() === 6) return false;
    const mmdd = pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
    return !FERIADOS_NACIONAIS.includes(mmdd) && !feriadosMoveis(d.getFullYear()).has(mmdd);
};

export const lastBusinessDay = (month, year) => {
    const lastDay = new Date(year, month, 0).getDate();
    let d = new Date(year, month - 1, lastDay);
    while (!isDiaUtil(d)) d.setDate(d.getDate() - 1);
    return d.getDate();
};

export const getDueDate = (compMonth, compYear, taxName, irpjCsllMode) => {
    if (!compMonth || !compYear) return '';
    const m = parseInt(compMonth), y = parseInt(compYear);
    let nextM = m + 1, nextY = y;
    if (nextM > 12) { nextM = 1; nextY++; }
    const pad = pad2;
    const dueDateMap = {
        'PIS': 25, 'COFINS': 25, 'PIS/COFINS': 25, 'ISS': 15, 'ISS (retido)': 15,
        'CPP': 20, 'CPP (Patronal)': 20, 'RAT': 20, 'RAT (Ajustado)': 20, 'Terceiros': 20,
        'INSS': 20, 'INSS (retido)': 20, 'INSS (Sócio)': 20, 'FGTS': 20,
        'DAS': 20, 'DAS-MEI': 20, 'ICMS (ST)': 10, 'DIFAL': 10,
        'ICMS': 20, 'Antecipação Parcial': 20, 'FUMACOP': 20,
        'IRRF': 20,
    };
    if (['IRPJ', 'CSLL', 'Adicional IRPJ'].includes(taxName)) {
        // Trimestral: a quota única vence no mês seguinte ao ENCERRAMENTO do trimestre (mar/jun/set/dez)
        if (irpjCsllMode === 'Trimestral (Apuração)' && ![3, 6, 9, 12].includes(m)) return '';
        return `${pad(lastBusinessDay(nextM, nextY))}/${pad(nextM)}/${nextY}`;
    }
    const dia = dueDateMap[taxName];
    if (!dia) return '';
    // Dia não útil: tributos federais de folha e PIS/COFINS ANTECIPAM; DAS, ISS e guias estaduais POSTERGAM
    const antecipa = ['PIS', 'COFINS', 'PIS/COFINS', 'CPP', 'CPP (Patronal)', 'RAT', 'RAT (Ajustado)', 'Terceiros', 'INSS', 'INSS (retido)', 'INSS (Sócio)', 'FGTS', 'IRRF'].includes(taxName);
    const d = new Date(nextY, nextM - 1, dia);
    while (!isDiaUtil(d)) d.setDate(d.getDate() + (antecipa ? -1 : 1));
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const getBasePresumidaLP = (revenue, taxName, atividade, irpjCsllMode, equiparada) => {
    const isServ = (atividade || 'Serviços') === 'Serviços';
    const eq = isServ ? Math.min(Math.max(parseNumBR(equiparada) || 0, 0), revenue) : 0;
    const norm = revenue - eq;
    const baseIRPJ = isServ ? (eq * 0.08 + norm * 0.32) : (revenue * 0.08);
    const baseCSLL = isServ ? (eq * 0.12 + norm * 0.32) : (revenue * 0.12);
    if (taxName === 'Adicional IRPJ') {
        const limit = (irpjCsllMode === 'Trimestral (Apuração)') ? 60000 : 20000;
        return Math.max(0, baseIRPJ - limit);
    }
    if (taxName === 'IRPJ') return baseIRPJ;
    if (taxName === 'CSLL') return baseCSLL;
    return revenue;
};

export const formatBRLDisplay = (num) => {
    if (!num && num !== 0) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ===== Importação de PGDAS-D (PDF) =====
export const pgNum = parseNumBR;

export async function extractPdfText(file) {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib) throw new Error('Leitor de PDF (pdf.js) não carregou. Verifique a conexão.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join('\n') + '\n';
    }
    return text;
}

export function parsePGDASD(T) {
    const res = { ok: false };
    if (!/Simples\s+Nacional|Per[ií]odo\s+de\s+Apura|PGDAS|Documento\s+de\s+Arrecada/i.test(T)) { res.error = 'O arquivo não parece ser um PGDAS-D.'; return res; }
    const g = (re) => { const m = T.match(re); return m; };
    const cnpj = g(/CNPJ\s+Matriz:\s*([\d.]+\/\d{4}-\d{2})/i);
    const nome = g(/Nome\s+empresarial:\s*([\s\S]*?)\s*Data\s+de\s+abertura/i);
    const comp = g(/Per[ií]odo\s+de\s+Apura[çc][ãa]o:\s*\d{2}\/(\d{2})\/(\d{4})/i);
    const rpa = g(/RPA\)[\s\S]*?Compet[êe]ncia\s*([\d.]+,\d{2})/i);
    const rbt12 = g(/\(RBT12\)[^\d]*?([\d.]+,\d{2})/);
    const folha = g(/Total\s+de\s+Folhas\s+de\s+Sal[áa]rios\s+Anteriores[\s\S]*?R\$\s*([\d.]+,\d{2})/i);
    const fator = g(/Fator\s+r\s*=\s*([\d,]+)\s*[-–—]\s*(Anexo\s+[IVX]+)/i);
    const das = g(/Valor\s+Total\s+do\s+D[ée]bito\s+Declarado[^\d]*([\d.]+,\d{2})(?:\D{0,40}([\d.]+,\d{2}))?/i);
    const mun = g(/Munic[íi]pio:\s*([A-Za-zÀ-ú][A-Za-zÀ-ú .]*?)\s*UF:\s*([A-Z]{2})/i);

    if (cnpj) res.cnpj = cnpj[1];
    if (nome) res.nome = nome[1].replace(/\s+/g, ' ').trim();
    if (comp) { res.compMonth = String(parseInt(comp[1])); res.compYear = comp[2]; res.competenceShort = comp[1] + '/' + comp[2]; }
    if (rpa) res.rpa = rpa[1];
    if (rbt12) res.rbt12 = rbt12[1];
    if (folha) res.folha12m = folha[1];
    if (fator) { res.fatorR = fator[1]; res.anexo = fator[2].replace(/\s+/, ' '); }
    if (das) res.das = das[2] || das[1];
    if (mun) res.municipio = mun[1].trim() + '/' + mun[2];
    res.atividade = /Presta[çc][ãa]o\s+de\s+Servi[çc]os/i.test(T) ? 'Serviços' : (/Com[ée]rcio/i.test(T) ? 'Comércio' : 'Serviços');
    // Mais de um estabelecimento: os valores capturados podem ser só da matriz — avisar o usuário.
    // Detecta por CNPJs DISTINTOS (filiais de verdade), não pela palavra "Estabelecimento"
    // (que pode aparecer várias vezes no layout mesmo com um único estabelecimento).
    const cnpjsDistintos = new Set(T.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || []);
    if (cnpjsDistintos.size > 1) res.multiEstab = true;

    // Evolução do faturamento — seção 2.2.1 (Mercado Interno); fallback se 2.2.2 não existir no layout
    const block = T.match(/2\.2\.1\)[^]*?(?:2\.2\.2\)|2\.3\)|$)/);
    const ev = {};
    if (block) {
        const re = /(\d{2}\/\d{4})\s+([\d.]+,\d{2})/g; let m;
        while ((m = re.exec(block[0]))) ev[m[1]] = pgNum(m[2]);
    }
    if (res.compMonth && res.compYear) {
        const series = []; const mo = parseInt(res.compMonth), yr = parseInt(res.compYear);
        for (let k = 11; k >= 0; k--) {
            let mm = mo - k, yy = yr; while (mm <= 0) { mm += 12; yy--; }
            const key = String(mm).padStart(2, '0') + '/' + yy;
            let val = ev[key] || 0;
            if (mm === mo && yy === yr) val = pgNum(res.rpa);
            series.push({ ym: key, receita: val });
        }
        res.evolucao = series;
    }
    res.ok = !!(res.cnpj || res.rpa || res.das);
    return res;
}

export const autoFillTaxes = (data, currentTaxes) => {
    const totalRevenue = calculateTotalRevenue(data);
    const revComRetencao = (data.regime === 'Lucro Presumido' || data.regime === 'Lucro Real') ? parseNumBR(data.revenueRetained) : 0;
    
    const proLaboreList = getProLabores(data);
    const proLabore = proLaboreList.reduce((s, v) => s + v, 0); // total (CPP, Fator R etc.)
    const rbt12 = parseNumBR(data.rbt12);
    const folha12m = parseNumBR(data.folha12m !== undefined ? data.folha12m : data.folha);
    const folhaMensal = parseNumBR(data.folhaMensal !== undefined ? data.folhaMensal : data.folha);
    const atividade = data.atividade || 'Serviços';
    const sujeitoFatorR = isSujeitoFatorR(data, folha12m);
    const isComercioInd = atividade === 'Comércio' || atividade === 'Indústria';
    const isLPouReal = data.regime === 'Lucro Presumido' || data.regime === 'Lucro Real';
    const mov = (isLPouReal && isComercioInd) ? calcComercioLP(data, totalRevenue) : null;
    const fmtPct = (n) => n.toFixed(2).replace('.', ',');

    return currentTaxes.map(t => {
        const updated = { ...t };
        const isRegimeNormal = data.regime === 'Lucro Presumido' || data.regime === 'Lucro Real';
        const isAnexoIV = data.regime === 'Simples Nacional' && data.anexo === 'Anexo IV';

        if (isRegimeNormal || isAnexoIV) {
            const baseFat = ['PIS', 'COFINS', 'PIS/COFINS', 'ISS'];
            const basePres = ['IRPJ', 'CSLL', 'Adicional IRPJ'];
            // CPP (20%) incide sobre folha + pró-labore; RAT, Terceiros e FGTS só sobre a folha de empregados
            const baseCPP = ['CPP', 'CPP (Patronal)'];
            const baseFolhaEmp = ['RAT', 'RAT (Ajustado)', 'Terceiros', 'FGTS'];

            if (baseFat.includes(t.tax)) {
                if (t.tax === 'PIS' || t.tax === 'COFINS' || t.tax === 'PIS/COFINS') {
                    // Revenda monofásica/ST: PIS/COFINS já recolhido na origem → fora da base
                    const mono = parseNumBR(data.receitaMonofasica);
                    const basePC = Math.max(0, totalRevenue - mono);
                    updated.base = totalRevenue > 0 ? formatBRLDisplay(basePC) : "";
                    updated.obs = mono > 0 ? 'Base sem revenda monofásica/ST (− ' + formatBRLDisplay(mono) + ')' : (updated.obs || 'Regime cumulativo');
                } else {
                    updated.base = totalRevenue > 0 ? formatBRLDisplay(totalRevenue) : "";
                }
            } else if (basePres.includes(t.tax) && isRegimeNormal) {
                const baseRevenueToUse = (data.irpjCsllMode === 'Trimestral (Apuração)' || data.irpjCsllMode === 'Estimativa (Anual)') && parseNumBR(data.periodRevenue) > 0
                    ? parseNumBR(data.periodRevenue)
                    : totalRevenue;
                updated.base = baseRevenueToUse > 0 ? formatBRLDisplay(getBasePresumidaLP(baseRevenueToUse, t.tax, atividade, data.irpjCsllMode, data.equiparacaoHospitalar ? data.receitaEquiparacao : 0)) : "";
            } else if (baseCPP.includes(t.tax)) {
                const totalFolhaEProLabore = proLabore + folhaMensal;
                updated.base = totalFolhaEProLabore > 0 ? formatBRLDisplay(totalFolhaEProLabore) : "";
            } else if (baseFolhaEmp.includes(t.tax)) {
                updated.base = folhaMensal > 0 ? formatBRLDisplay(folhaMensal) : "";
            }
            
            const b = parseNumBR(updated.base);
            const r = parseNumBR(updated.rate);
            
            if (b > 0 && r > 0) {
                updated.apurado = formatBRLDisplay(b * r / 100);
            } else {
                updated.apurado = "";
            }

            // FAP (Fator Acidentário de Prevenção) multiplica o RAT: RAT Ajustado = RAT × FAP (0,5 a 2,0)
            if (t.tax === 'RAT' || t.tax === 'RAT (Ajustado)') {
                const fap = parseNumBR(data.fap);
                if (fap > 0 && fap !== 1 && b > 0 && r > 0) {
                    updated.apurado = formatBRLDisplay(b * (r * fap) / 100);
                    updated.obs = 'RAT ' + r.toFixed(2).replace('.', ',') + '% × FAP ' + fap.toFixed(4).replace('.', ',');
                }
            }

            // Lucro Real não-cumulativo: PIS/COFINS apurado informado (já líquido de créditos) prevalece
            if (t.tax === 'PIS' && parseNumBR(data.pisApurado) > 0) {
                updated.apurado = formatBRLDisplay(parseNumBR(data.pisApurado));
                updated.obs = 'Apurado informado (não-cumulativo, líquido de créditos)';
            }
            if (t.tax === 'COFINS' && parseNumBR(data.cofinsApurado) > 0) {
                updated.apurado = formatBRLDisplay(parseNumBR(data.cofinsApurado));
                updated.obs = 'Apurado informado (não-cumulativo, líquido de créditos)';
            }

            if (['IRPJ', 'CSLL', 'Adicional IRPJ'].includes(t.tax) && isRegimeNormal) {
                if (data.irpjCsllMode === 'Trimestral (Apuração)') {
                    updated.obs = "Apuração definitiva do trimestre";
                } else if (data.irpjCsllMode === 'Estimativa (Anual)') {
                    updated.obs = "Estimativa mensal (Lucro Real Anual)";
                } else {
                    updated.obs = "Provisão mensal (Venc. Real Trimestral)";
                }
            }

            if (isRegimeNormal && atividade === 'Serviços' && revComRetencao > 0) {
                if (!t.retidoManual) {
                    if (t.tax === 'PIS') updated.retido = formatBRLDisplay(revComRetencao * 0.0065);
                    else if (t.tax === 'COFINS') updated.retido = formatBRLDisplay(revComRetencao * 0.03);
                    else if (t.tax === 'CSLL') updated.retido = formatBRLDisplay(revComRetencao * 0.01);
                    else if (t.tax === 'IRPJ') updated.retido = formatBRLDisplay(revComRetencao * 0.015);
                    else if (t.tax === 'ISS') updated.retido = formatBRLDisplay(revComRetencao * (parseNumBR(t.rate) / 100));
                }
            } else if (isRegimeNormal && atividade === 'Serviços' && revComRetencao === 0) {
                if (!t.retidoManual) {
                    updated.retido = "";
                }
            }
        }

        // ===== Estaduais do comércio (LP/Real): ICMS por débito/crédito e FUMACOP (2%) =====
        // Antecipação Parcial e DIFAL são linhas de valor manual — não recalculadas aqui.
        if (mov) {
            if (t.tax === 'ICMS') {
                const icmsSped = parseNumBR(data.icmsApurado);
                if (icmsSped > 0) {
                    // O contador fechou a EFD (SPED Fiscal): valor apurado prevalece sobre a estimativa
                    updated.base = formatBRLDisplay(totalRevenue);
                    updated.rate = '';
                    updated.apurado = formatBRLDisplay(icmsSped);
                    updated.obs = 'ICMS apurado no SPED/EFD (débito − crédito − ST − ajustes)';
                } else if (mov.icms) {
                    updated.base = formatBRLDisplay(mov.icms.baseSaidas);
                    updated.rate = mov.icms.manual ? '' : fmtPct(mov.icms.aliqS);
                    if (mov.icms.aPagar > 0) {
                        updated.apurado = formatBRLDisplay(mov.icms.aPagar);
                        const tail = mov.icms.manual
                            ? ' (totais informados)'
                            : (mov.icms.saidasST > 0 ? ` · ST fora do débito (− ${formatBRLDisplay(mov.icms.saidasST)})` : '') + ' · estimativa, confira no SPED';
                        updated.obs = `Débito ${formatBRLDisplay(mov.icms.debito)} − créditos ${formatBRLDisplay(mov.icms.credito)}` + tail;
                    } else {
                        updated.apurado = "";
                        updated.obs = mov.icms.saldoCredor > 0 ? `Saldo credor de R$ ${formatBRLDisplay(mov.icms.saldoCredor)} p/ a próxima competência` : '';
                    }
                } else {
                    updated.base = ""; updated.apurado = ""; updated.obs = "Apuração por débito e crédito";
                }
            } else if (t.tax === 'FUMACOP') {
                updated.base = formatBRLDisplay(mov.baseFumacop);
                updated.rate = "2,00";
                updated.apurado = mov.fumacop > 0 ? formatBRLDisplay(mov.fumacop) : "";
                updated.obs = "Adicional de 2% — Lei 8.205/2004 (MA)";
            } else if (t.tax === 'DIFAL' && mov.difal > 0) {
                updated.base = formatBRLDisplay(parseNumBR(data.baseDifal));
                updated.rate = mov.difalRate.toFixed(2).replace('.', ',');
                updated.apurado = formatBRLDisplay(mov.difal);
                updated.obs = `Alíq. interna ${mov.aliqInterna.toFixed(2).replace('.', ',')}% − interestadual ${mov.aliqInter.toFixed(2).replace('.', ',')}%`;
            } else if (t.tax === 'Antecipação Parcial' && mov.antecipacao > 0) {
                updated.base = formatBRLDisplay(parseNumBR(data.baseAntecipacao));
                updated.rate = mov.difalRate.toFixed(2).replace('.', ',');
                updated.apurado = formatBRLDisplay(mov.antecipacao);
                updated.obs = `Alíq. interna ${mov.aliqInterna.toFixed(2).replace('.', ',')}% − interestadual ${mov.aliqInter.toFixed(2).replace('.', ',')}%`;
            }
        }

        if (data.regime === 'Simples Nacional') {
            if (t.tax === 'DAS') {
                if (totalRevenue > 0 && rbt12 > 0 && data.anexo) {
                    const fR = calcFatorR(folha12m, rbt12);
                    const anexoEf = getAnexoEfetivo(data.anexo, fR, sujeitoFatorR);
                    const res = calcAliquotaEfetivaSN(rbt12, anexoEf);

                    updated.base = formatBRLDisplay(totalRevenue);
                    updated.rate = res.rate.toFixed(4).replace('.', ',');

                    const apuradoDAS = totalRevenue * res.rate / 100;
                    updated.apurado = formatBRLDisplay(apuradoDAS);
                    let obsDAS = `${anexoEf} (Faixa ${res.faixa}) — Alíq. Nom. ${res.nominal.toFixed(2).replace('.', ',')}%`;
                    if (rbt12 > LIMITE_SN) obsDAS += ' · ATENÇÃO: RBT12 acima do limite do Simples (R$ 4,8 mi)';
                    else if (rbt12 > SUBLIMITE_SN) obsDAS += ' · RBT12 acima do sublimite: ICMS/ISS fora do DAS';
                    // ISS retido na fonte (linha 'ISS (retido)') abate o DAS — a parcela de ISS
                    // já foi recolhida pelo tomador. Respeita retido digitado manualmente no DAS.
                    if (!t.retidoManual) {
                        const issRetRow = currentTaxes.find(x => /ISS/i.test(x.tax || '') && /\(retido\)/i.test(x.tax || ''));
                        const issRet = issRetRow ? parseNumBR(issRetRow.value) : 0;
                        updated.retido = issRet > 0 ? formatBRLDisplay(issRet) : '';
                        if (issRet > 0) obsDAS += ` · ISS retido ${formatBRLDisplay(issRet)} abatido`;
                    }
                    updated.obs = obsDAS;
                } else {
                    updated.base = ""; updated.apurado = ""; updated.obs = "";
                }
            }
        }

        if (t.tax === 'INSS' || t.tax === 'INSS (Sócio)') {
            if (proLabore > 0) {
                let r = parseNumBR(updated.rate);
                if (!(r > 0)) { updated.rate = "11,00"; r = 11; }
                // 11% por sócio, cada um limitado ao teto previdenciário INDIVIDUALMENTE
                const baseINSS = proLaboreList.reduce((s, pl) => s + Math.min(pl, TETO_INSS), 0);
                updated.base = formatBRLDisplay(baseINSS);
                updated.apurado = formatBRLDisplay(baseINSS * r / 100);
                const algumNoTeto = proLaboreList.some(pl => pl > TETO_INSS);
                if (proLaboreList.length > 1) updated.obs = proLaboreList.length + ' sócios · 11% por sócio' + (algumNoTeto ? ' (teto individual aplicado)' : '');
                else if (algumNoTeto) updated.obs = 'Retenção sobre Pró-labore · base limitada ao teto do INSS (R$ ' + formatBRLDisplay(TETO_INSS) + ')';
            } else {
                updated.base = ""; updated.apurado = "";
            }
        }

        // IRRF sobre o pró-labore — tabela progressiva mensal (base = PL − INSS).
        // Incide em todos os regimes (exceto MEI, sem pró-labore tributável próprio).
        if (t.tax === 'IRRF') {
            if (proLabore > 0 && data.regime !== 'MEI') {
                let baseIRRF = 0, irrfTotal = 0, aliq = 0;
                if (proLaboreList.length > 1) {
                    // Cada sócio tem sua própria base e faixa progressiva
                    proLaboreList.forEach(pl => {
                        const r = calcIRRFProLabore(pl, Math.min(pl, TETO_INSS) * 0.11);
                        baseIRRF += r.base; irrfTotal += r.imposto;
                    });
                } else {
                    // Sócio único: acopla ao INSS apurado da linha INSS (Sócio) quando existir
                    const inssRow = currentTaxes.find(x => x.tax === 'INSS (Sócio)' || x.tax === 'INSS');
                    const inssVal = inssRow && parseNumBR(inssRow.apurado) > 0 ? parseNumBR(inssRow.apurado) : Math.min(proLabore, TETO_INSS) * 0.11;
                    const r = calcIRRFProLabore(proLabore, inssVal);
                    baseIRRF = r.base; irrfTotal = r.imposto; aliq = r.aliquota;
                }
                updated.base = formatBRLDisplay(baseIRRF);
                updated.rate = aliq > 0 ? aliq.toFixed(2).replace('.', ',') : '';
                updated.apurado = irrfTotal > 0 ? formatBRLDisplay(irrfTotal) : '';
                updated.obs = irrfTotal > 0
                    ? (proLaboreList.length > 1 ? proLaboreList.length + ' sócios · IRRF por sócio (tabela progressiva)' : 'Pró-labore · base ' + formatBRLDisplay(baseIRRF) + ' (PL − INSS) · tabela progressiva')
                    : (proLaboreList.every(pl => pl <= 5000) ? 'Isento — Lei 15.270/2025 (até R$ 5.000 por sócio)' : 'Sem imposto a reter após deduções');
            } else {
                updated.base = ""; updated.apurado = ""; updated.obs = "Pró-labore";
            }
        }

        const apurado = parseNumBR(updated.apurado);
        const retido = parseNumBR(updated.retido);
        // Tributos gerenciados pelo motor têm o valor recalculado/limpo; linhas customizadas
        // (nome livre, só "Valor" digitado) preservam o que o usuário digitou
        const MANAGED = ['PIS', 'COFINS', 'PIS/COFINS', 'ISS', 'IRPJ', 'CSLL', 'Adicional IRPJ', 'CPP', 'CPP (Patronal)', 'RAT', 'RAT (Ajustado)', 'Terceiros', 'FGTS', 'DAS', 'INSS', 'INSS (Sócio)', 'ICMS', 'FUMACOP', 'IRRF'];
        if (apurado > 0 || retido > 0) {
            updated.value = formatBRLDisplay(Math.max(0, apurado - retido));
        } else if (MANAGED.includes(t.tax)) {
            updated.value = "";
        }

        if (data.compMonth && data.compYear && t.tax) {
            const due = getDueDate(data.compMonth, data.compYear, t.tax, data.irpjCsllMode);
            if (due) updated.dueDate = due;
            else if (['IRPJ', 'CSLL', 'Adicional IRPJ'].includes(t.tax) && data.irpjCsllMode === 'Trimestral (Apuração)') updated.dueDate = '';
        }

        return updated;
    });
};

export const STORAGE_KEY = 'sete-apuracao-draft';
