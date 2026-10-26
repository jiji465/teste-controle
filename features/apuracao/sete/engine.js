import { isWeekendOrHoliday } from "../../../lib/date-utils";
// PDF.js é carregado sob demanda (dynamic import) dentro de extractPdfText.
// No Next.js não usamos o import "?url" do Vite — o worker é apontado para a CDN.

export const COLORS_MAP = { NAVY: "#1e3a8a", GOLD: "#C5A059", SLATE_DARK: "#334155", SLATE_MID: "#64748b" };
export const OFFICE_NAME = "SETE Soluções Empresariais";

// ===== Valores anuais — ATUALIZAR a cada virada de exercício =====
export const SALARIO_MINIMO = 1621.00;   // 2026
export const TETO_INSS = 8475.55;        // 2026 — Portaria MPS/MF nº 13/2026
export const SUBLIMITE_SN = 3600000;     // sublimite do Simples: acima, ICMS/ISS fora do DAS
export const LIMITE_SN = 4800000;        // teto do Simples Nacional

// Converte texto monetário em número. Aceita o formato BR ("1.234,56", "R$ 1.000,50"),
// ponto decimal ("1234.56", "1.5" — dados importados/colados), formato US
// ("1,234.56") e negativo contábil "(1.000,00)". Só ponto em grupos de 3 dígitos
// ("1.234", "1.234.567") é milhar BR. NaN/Infinity/vazio → 0.
export const parseNumBR = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v === null || v === undefined) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[^\d.,-]/g, '');
    if (s.startsWith('-')) neg = !neg;
    s = s.replace(/-/g, '');
    if (!/\d/.test(s)) return 0;
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma >= 0 && lastDot > lastComma) s = s.replace(/,/g, '');                 // US
    else if (lastComma >= 0) s = s.replace(/\./g, '').replace(/,/g, '.');             // BR
    else if (lastDot >= 0) {
        if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');                  // milhar BR
        else s = s.slice(0, lastDot).replace(/\./g, '') + '.' + s.slice(lastDot + 1);  // decimal
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? (neg ? -n : n) : 0;
};

export const formatCurrency = (val) => {
    const num = parseNumBR(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};
export const formatPercent = (val) => (parseNumBR(val) || 0).toFixed(2).replace('.', ',') + '%';

export const calculateTotalRevenue = (data) => {
    const isSimplesOuMei = data.regime === 'Simples Nacional' || data.regime === 'MEI';
    if (isSimplesOuMei) return parseNumBR(data.revenue);
    // Comércio/Indústria não tem "receita com retenção" (conceito de serviços): usa só as
    // saídas (revenueNonRetained). Evita que um valor de "COM retenção" digitado antes de
    // trocar a atividade continue somando na receita total (vazamento entre atividades).
    const isComercioInd = data.atividade === 'Comércio' || data.atividade === 'Indústria';
    if (isComercioInd) return parseNumBR(data.revenueNonRetained);
    return parseNumBR(data.revenueRetained) + parseNumBR(data.revenueNonRetained);
};

export const formatCNPJ = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 14);
    return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
};

// ===== Classificação de linhas para os totais =====
// Linhas "(retido)" são informativas (o tributo já foi retido na fonte) — não são guia a pagar.
export const ehRetido = (t) => /\(retido\)/i.test((t && t.tax) || '');
// Encargos sobre folha/pró-labore (INSS/IRRF/FGTS/CPP/RAT/Terceiros) NÃO incidem sobre o
// faturamento → ficam FORA da carga tributária efetiva (ajustável por linha via `foraAliquota`).
export const isFolhaTax = (name) => /\b(INSS|IRRF|FGTS|CPP|RAT|Terceiros)\b/i.test(name || '');
export const entraNaAliquota = (t) => (t && t.foraAliquota !== undefined) ? !t.foraAliquota : !isFolhaTax(t && t.tax);
// Provisão (ex.: IRPJ/CSLL mensal no LP trimestral): imposto atribuível ao mês, mas NÃO
// recolhido neste mês (o DARF é trimestral). Conta na carga do período, fora do caixa do mês.
export const ehProvisao = (t) => !!(t && t.provisao);

// ===== Fonte ÚNICA dos totais (relatório, resumo ao vivo e persistência) =====
// Evita as contas divergentes que faziam o número e o "%" do KPI não baterem.
//   totalRecolherMes = caixa a recolher no mês (exclui retido e provisão)
//   totalProvisao    = provisão do mês (IRPJ/CSLL a recolher no fechamento do trimestre)
//   baseCarga        = tributos que incidem sobre a receita (exclui folha; inclui provisão)
//   cargaEfetiva     = baseCarga / faturamento  ·  liquido = faturamento − baseCarga
//   totalApurado     = apurado bruto de todas as guias (compat. com a persistência)
// ===== Avisos de sanidade (não-bloqueantes) — reduzem erro de digitação =====
// Sinaliza situações suspeitas sem impedir o uso: alíquota fora de faixa, retenção
// maior que o apurado (valor zerado em silêncio), e tributos duplicados.
export const FAIXA_ALIQUOTA = { ISS: [2, 5], 'ISS (retido)': [2, 5], ICMS: [0, 35], 'ICMS (ST)': [0, 35] };
export const avisosApuracao = (taxes) => {
    const avisos = [];
    const cont = {};
    (taxes || []).forEach((t) => {
        if (!t || !t.tax) return;
        const ap = parseNumBR(t.apurado);
        const ret = parseNumBR(t.retido);
        const rate = parseNumBR(t.rate);
        cont[t.tax] = (cont[t.tax] || 0) + 1;
        // Retenção maior que o apurado → "A pagar" é zerado silenciosamente (Math.max(0, …))
        if (ret > 0 && ap > 0 && ret > ap + 0.005) {
            avisos.push({ tax: t.tax, nivel: 'erro', msg: `retido (${formatCurrency(ret)}) maior que o apurado (${formatCurrency(ap)})` });
        }
        // FAP fora da faixa legal (0,5–2,0) foi limitado pelo motor
        if (/FAP .*fora da faixa/i.test(t.obs || '')) avisos.push({ tax: t.tax, nivel: 'aviso', msg: 'FAP fora da faixa 0,5–2,0 — confira o valor informado' });
        // Alíquota acima de 100%
        if (rate > 100) avisos.push({ tax: t.tax, nivel: 'erro', msg: `alíquota ${rate.toFixed(2).replace('.', ',')}% acima de 100%` });
        // Alíquota fora da faixa usual do tributo
        const faixa = FAIXA_ALIQUOTA[t.tax];
        if (faixa && rate > 0 && (rate < faixa[0] || rate > faixa[1])) {
            avisos.push({ tax: t.tax, nivel: 'aviso', msg: `${t.tax} ${rate.toFixed(2).replace('.', ',')}% fora da faixa usual (${faixa[0]}–${faixa[1]}%)` });
        }
    });
    Object.entries(cont).forEach(([tax, n]) => {
        if (n > 1) avisos.push({ tax, nivel: 'aviso', msg: `${tax} aparece ${n}× — possível duplicidade` });
    });
    return avisos;
};

// ===== Acumulado do período (LP trimestral/estimativa) a partir do histórico salvo =====
// Soma o faturamento dos meses do período: meses anteriores vêm dos `records` salvos
// (compKey 'AAAA-MM' + faturamento) e o mês corrente usa a receita viva da tela.
//   Trimestral  → meses do trimestre atual até a competência
//   Estimativa  → janeiro até a competência
// Retorna null quando o modo não acumula ou faltam mês/ano.
export const acumuladoPeriodo = (data, records) => {
    const m = parseInt(data.compMonth), y = parseInt(data.compYear);
    const mode = data.irpjCsllMode;
    if (!m || !y) return null;
    let startM;
    if (mode === 'Trimestral (Apuração)') startM = Math.floor((m - 1) / 3) * 3 + 1;
    else if (mode === 'Estimativa (Anual)') startM = 1;
    else return null;
    // Receita COM retenção do período: as retenções de IRPJ/CSLL de todos os meses do
    // trimestre compensam o DARF trimestral (Lei 9.430, art. 64; Lei 10.833, arts. 30 e 36).
    const retidaDe = (d) => (d && (d.regime === 'Lucro Presumido' || d.regime === 'Lucro Real') && (d.atividade || 'Serviços') === 'Serviços')
        ? parseNumBR(d.revenueRetained) : 0;
    let total = 0, totalRetido = 0, salvos = 0, faltando = 0;
    for (let mm = startM; mm <= m; mm++) {
        if (mm === m) { total += calculateTotalRevenue(data); totalRetido += retidaDe(data); continue; }
        const key = y + '-' + String(mm).padStart(2, '0');
        const rec = (records || []).find(r => r && r.compKey === key);
        const fat = rec ? parseNumBR(rec.faturamento) : 0;
        if (fat > 0) { total += fat; salvos++; } else faltando++;
        const cd = rec && rec.payload && rec.payload.clientData;
        if (cd) totalRetido += retidaDe({ regime: cd.regime || data.regime, atividade: cd.atividade || data.atividade, revenueRetained: cd.revenueRetained });
    }
    return { total, totalRetido, salvos, faltando, meses: m - startM + 1 };
};

export const resumoApuracao = (taxes, revenue) => {
    const rev = parseNumBR(revenue);
    let totalRecolherMes = 0, totalProvisao = 0, totalRetido = 0, baseCarga = 0, totalApurado = 0;
    (taxes || []).forEach((t) => {
        totalRetido += parseNumBR(t.retido);
        if (ehRetido(t)) return; // linha informativa, não entra em nenhum total de guia
        const val = parseNumBR(t.value);
        const apur = parseNumBR(t.apurado) || val;
        if (ehProvisao(t)) totalProvisao += val; else totalRecolherMes += val;
        totalApurado += apur;
        // `cargaMes`: no fechamento do LP trimestral o apurado é do TRIMESTRE inteiro;
        // a carga mostrada é só a parcela do mês (igual à provisão dos meses comuns).
        if (entraNaAliquota(t)) baseCarga += (t.cargaMes !== undefined && t.cargaMes !== '') ? parseNumBR(t.cargaMes) : apur;
    });
    const cargaEfetiva = rev > 0 ? (baseCarga / rev) * 100 : 0;
    const liquido = rev - baseCarga;
    return { totalRecolherMes, totalProvisao, totalRetido, baseCarga, totalApurado, cargaEfetiva, liquido };
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
    { id: 13, tax: "INSS (Empregados)", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Retenção do empregado (tabela progressiva 7,5%–14%, teto R$ 8.475,55) — informe o valor da folha", retidoManual: false },
];

// Comércio/Indústria no LP: ICMS por débito e crédito no lugar do ISS.
// Antecipação Parcial e DIFAL ficam como linhas de valor manual (nem sempre seguem alíquota).
export const DEFAULT_TAXES_LP_COMERCIO = [
    { id: 1, tax: "PIS", base: "", rate: "0,65", apurado: "", retido: "", value: "", dueDate: "", obs: "Regime cumulativo", retidoManual: false },
    { id: 2, tax: "COFINS", base: "", rate: "3,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Regime cumulativo", retidoManual: false },
    { id: 3, tax: "ICMS", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "ICMS próprio apurado no SPED/EFD", retidoManual: false },
    { id: 4, tax: "IRPJ", base: "", rate: "15,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Provisão mensal (Venc. Real Trimestral)", retidoManual: false },
    { id: 12, tax: "Adicional IRPJ", base: "", rate: "10,00", apurado: "", retido: "", value: "", dueDate: "", obs: "10% sobre a base que exceder R$ 20 mil/mês (R$ 60 mil/trim)", retidoManual: false },
    { id: 5, tax: "CSLL", base: "", rate: "9,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Provisão mensal (Venc. Real Trimestral)", retidoManual: false },
    { id: 6, tax: "CPP (Patronal)", base: "", rate: "20,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Contribuição previdenciária", retidoManual: false },
    { id: 7, tax: "RAT", base: "", rate: "1,00", apurado: "", retido: "", value: "", dueDate: "", obs: "Risco Ambiental do Trabalho", retidoManual: false },
    { id: 8, tax: "Terceiros", base: "", rate: "5,80", apurado: "", retido: "", value: "", dueDate: "", obs: "SESC, SENAC, SEBRAE, etc.", retidoManual: false },
    { id: 9, tax: "FGTS", base: "", rate: "8,00", apurado: "", retido: "", value: "", dueDate: "", obs: "8% sobre a folha de salários", retidoManual: false },
    { id: 13, tax: "INSS (Empregados)", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "Retenção do empregado (tabela progressiva 7,5%–14%, teto R$ 8.475,55) — informe o valor da folha", retidoManual: false },
];
// Guias estaduais do comércio adicionadas por interruptor (valor lançado, não calculado):
// ICMS (ST) — substituto; Antecipação Parcial e DIFAL — ICMS interestadual; FUMACOP — adicional MA.
export const COMERCIO_GUIA_ESTADUAL = {
    icmsST: { tax: "ICMS (ST)", obs: "ICMS-ST recolhido como substituto tributário" },
    antecipacao: { tax: "Antecipação Parcial", obs: "Antecipação parcial de ICMS (entrada interestadual)" },
    difal: { tax: "DIFAL", obs: "Diferencial de alíquota (compras interestaduais)" },
    fumacop: { tax: "FUMACOP", obs: "Adicional FUMACOP — Lei 8.205/2004 (MA)" },
};

export const lpDefaults = (atividade) => (atividade === 'Comércio' || atividade === 'Indústria') ? DEFAULT_TAXES_LP_COMERCIO : DEFAULT_TAXES_LP;

// Lucro Real: PIS/COFINS NÃO cumulativos — 1,65% / 7,6% (Leis 10.637/02 e 10.833/03).
// Sem os créditos informados, o motor apura sobre a receita bruta (valor máximo) e avisa;
// o apurado líquido de créditos vai em pisApurado/cofinsApurado.
export const OBS_NAO_CUMULATIVO = 'Não cumulativo (1,65% / 7,6%) sem créditos — informe o apurado líquido';
const toLucroReal = (list) => list.map(t =>
    t.tax === 'PIS' ? { ...t, rate: '1,65', obs: OBS_NAO_CUMULATIVO }
        : t.tax === 'COFINS' ? { ...t, rate: '7,60', obs: OBS_NAO_CUMULATIVO }
            : (t.tax === 'IRPJ' || t.tax === 'CSLL') ? { ...t, obs: 'Estimativa mensal (Lucro Real)' }
                : t);
export const DEFAULT_TAXES_LR = toLucroReal(DEFAULT_TAXES_LP);
export const DEFAULT_TAXES_LR_COMERCIO = toLucroReal(DEFAULT_TAXES_LP_COMERCIO);

/** Tributos padrão do regime normal (LP ou Real) conforme a atividade. */
export const regimeDefaults = (regime, atividade) => {
    const comInd = atividade === 'Comércio' || atividade === 'Indústria';
    if (regime === 'Lucro Real') return comInd ? DEFAULT_TAXES_LR_COMERCIO : DEFAULT_TAXES_LR;
    return lpDefaults(atividade);
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
    { acronym: "INSS (Empregados)", full: "Contribuição do Segurado (Empregados)", icon: "Scale", matchTaxes: ["INSS (Empregados)"], desc: "Retenção previdenciária descontada dos empregados pela tabela progressiva (7,5% a 14%, teto R$ 8.475,55 em 2026), recolhida junto com a contribuição patronal." },
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
    if (!table) return { rate: 0, nominal: 0, deduction: 0, faixa: 0 };
    // Sem RBT12 (início de atividade sem histórico de receita): a média das receitas
    // dos meses anteriores é 0 → 1ª faixa (Resolução CGSN 140/2018, art. 21). Como a
    // dedução da 1ª faixa é 0, a alíquota efetiva = nominal da faixa 1 (Anexo III = 6%).
    // Bate com o PGDAS-D de empresas novas cujos meses anteriores foram zerados.
    if (rbt12 <= 0) {
        const f = table[0];
        return { rate: f.rate, nominal: f.rate, deduction: 0, faixa: 1 };
    }
    const faixa = table.find(f => rbt12 <= f.limit) || table[table.length - 1];
    const faixaIdx = table.indexOf(faixa) + 1;
    const effective = ((rbt12 * (faixa.rate / 100)) - faixa.deduction) / rbt12 * 100;
    return { rate: Math.max(effective, 0), nominal: faixa.rate, deduction: faixa.deduction, faixa: faixaIdx };
};

export const calcFatorR = (folha12m, rbt12) => {
    if (!rbt12 || rbt12 <= 0) return 0;
    // Arredonda a 6 casas: sem isso 135.114,28 / 482.551,00 dava 27,999999999999996%
    // e uma empresa com Fator R de exatamente 28% caía no Anexo V.
    return Math.round((folha12m / rbt12) * 100 * 1e6) / 1e6;
};

// A migração Anexo III ↔ V pelo Fator R só vale para atividades sujeitas a ele (LC 123, art. 18, §5º-I/J).
// Atividades que são Anexo III por natureza (ex.: contabilidade, escolas) não migram.
export const getAnexoEfetivo = (anexo, fatorR, sujeitoFatorR = true) => {
    if (!sujeitoFatorR) return anexo;
    if (anexo === 'Anexo V' && fatorR >= 28) return 'Anexo III';
    if (anexo === 'Anexo III' && fatorR < 28) return 'Anexo V';
    return anexo;
};

// Sem flag explícita, só o Anexo V implica atividade de Fator R. Anexo III NÃO é presumido
// sujeito só por ter folha: contabilidade, escolas etc. são III por natureza e, antes,
// migravam indevidamente para o V (15,5%) quando a folha ficava abaixo de 28%.
export const isSujeitoFatorR = (data) =>
    data.sujeitoFatorR !== undefined ? !!data.sujeitoFatorR : data.anexo === 'Anexo V';

// ===== IRRF sobre o pró-labore (tabela progressiva mensal) =====
// Tabela 2026 (faixas mantidas de 2025) + redutor mensal da Lei 15.270/2025
// (vigente desde jan/2026): rendimento até R$ 5.000 fica isento e há redução
// parcial e decrescente entre R$ 5.000,01 e R$ 7.350. Base = pró-labore − INSS.
export const IRRF_DEPENDENTE = 189.59;
// Tabela progressiva mensal vigente (desde mai/2025, mantida em 2026).
// ⚠️ Antes estavam os valores de 2024 (isenção 2.259,20 e parcelas a deduzir
// 169,44 / 381,44 / 662,77 / 896,00), o que dava IRRF R$ 12,73 acima do que a
// Receita apura. A tabela atual elevou a isenção p/ 2.428,80 e cada parcela a
// deduzir em ~12,72 (última faixa: 908,73). Ex.: base 8.067,69 →
// 8.067,69×27,5% − 908,73 = 1.309,88 (batendo com o DARF/DCTFWeb).
export const IRRF_TABLE = [
    { limit: 2428.80, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 7.5, deduction: 182.16 },
    { limit: 3751.05, rate: 15, deduction: 394.16 },
    { limit: 4664.68, rate: 22.5, deduction: 675.49 },
    { limit: Infinity, rate: 27.5, deduction: 908.73 },
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

const pad2 = (n) => String(n).padStart(2, '0');

// Dia útil = sem fim de semana nem feriado nacional. Usa a MESMA tabela de
// feriados do resto do sistema (lib/date-utils) — antes havia uma cópia aqui
// que divergia (ex.: Consciência Negra antes de 2024).
const isDiaUtil = (d) => !isWeekendOrHoliday(d);

export const lastBusinessDay = (month, year) => {
    const lastDay = new Date(year, month, 0).getDate();
    let d = new Date(year, month - 1, lastDay);
    while (!isDiaUtil(d)) d.setDate(d.getDate() - 1);
    return d.getDate();
};

// "MM/AAAA" ou "DD/MM/AAAA" → { m, y }
const parseMesAno = (s) => {
    const mt = String(s || '').match(/(\d{1,2})\/(\d{4})\s*$/);
    if (!mt) return null;
    const m = parseInt(mt[1]), y = parseInt(mt[2]);
    return m >= 1 && m <= 12 ? { m, y } : null;
};

/**
 * RBT12 proporcionalizada de empresa em início de atividade (Res. CGSN 140/2018, art. 22):
 *  · no mês de início: receita do mês (RPA) × 12;
 *  · nos 11 meses seguintes: média aritmética da receita dos meses anteriores
 *    (desde o início; meses sem receita contam como 0) × 12.
 * Retorna null sem data de abertura ou com 12+ meses de atividade — aí vale a RBT12
 * normal (inclusive 0 para empresa inativa, que fica na 1ª faixa, como no PGDAS-D).
 */
/** Meses de atividade ANTERIORES ao PA (0 = mês de início); null sem data de abertura,
 *  com PA anterior à abertura ou com 12+ meses (fora do início de atividade). */
export const mesesInicioAtividade = (data) => {
    const ab = parseMesAno(data && data.dataAbertura);
    const m = parseInt(data && data.compMonth), y = parseInt(data && data.compYear);
    if (!ab || !m || !y) return null;
    const meses = (y * 12 + (m - 1)) - (ab.y * 12 + (ab.m - 1));
    return meses < 0 || meses > 11 ? null : meses;
};

export const rbt12InicioAtividade = (data) => {
    const meses = mesesInicioAtividade(data);
    if (meses === null) return null;
    const ab = parseMesAno(data.dataAbertura);
    const idxAb = ab.y * 12 + (ab.m - 1), idxComp = idxAb + meses;
    if (meses === 0) return calculateTotalRevenue(data) * 12;
    const ev = Array.isArray(data.evolucao) ? data.evolucao : [];
    let soma = 0;
    for (let k = idxAb; k < idxComp; k++) {
        const key = pad2((k % 12) + 1) + '/' + Math.floor(k / 12);
        const e = ev.find(x => x && x.ym === key);
        soma += e ? parseNumBR(e.receita) : 0;
    }
    return (soma / meses) * 12;
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
        'INSS': 20, 'INSS (retido)': 20, 'INSS (Sócio)': 20, 'INSS (Empregados)': 20, 'FGTS': 20,
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
    const antecipa = ['PIS', 'COFINS', 'PIS/COFINS', 'CPP', 'CPP (Patronal)', 'RAT', 'RAT (Ajustado)', 'Terceiros', 'INSS', 'INSS (retido)', 'INSS (Sócio)', 'INSS (Empregados)', 'FGTS', 'IRRF'].includes(taxName);
    const d = new Date(nextY, nextM - 1, dia);
    while (!isDiaUtil(d)) d.setDate(d.getDate() + (antecipa ? -1 : 1));
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const getBasePresumidaLP = (revenue, taxName, atividade, irpjCsllMode, equiparada, nMeses = 1) => {
    const isServ = (atividade || 'Serviços') === 'Serviços';
    const eq = isServ ? Math.min(Math.max(parseNumBR(equiparada) || 0, 0), revenue) : 0;
    const norm = revenue - eq;
    const baseIRPJ = isServ ? (eq * 0.08 + norm * 0.32) : (revenue * 0.08);
    const baseCSLL = isServ ? (eq * 0.12 + norm * 0.32) : (revenue * 0.12);
    if (taxName === 'Adicional IRPJ') {
        // Limite do adicional = R$ 20.000 por mês do período. Trimestral = 60.000;
        // Estimativa Anual (base acumulada) = 20.000 × nº de meses acumulados.
        const limit = irpjCsllMode === 'Trimestral (Apuração)' ? 60000
            : irpjCsllMode === 'Estimativa (Anual)' ? 20000 * Math.max(1, nMeses)
                : 20000;
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

// Rodapé repetido em toda página do PGDAS-D. O pdf.js o intercala no meio do conteúdo —
// em declarações reais ele cai entre "Valor Total do Débito Declarado" e os valores do
// resumo (2.6) e entre o cabeçalho e os números da tabela 2.8. Removido antes de ler.
const RODAPE_PGDAS = /N[úu]mero\s+da\s+Declara[çc][ãa]o:\s*\d+\s+N[úu]mero\s+do\s+Recibo:\s*[\d.-]+\s+Autentica[çc][ãa]o:\s*[\d.]+\s+P[áa]gina\s+\d+/gi;
const NUM_PG = '([\\d.]+,\\d{2})';
// Tabela de débito por tributo (por atividade, por estabelecimento e no Total Geral)
const TAB_TRIBUTOS = 'IRPJ\\s+CSLL\\s+COFINS\\s+PIS\\/Pasep\\s+INSS\\/CPP\\s+ICMS\\s+IPI\\s+ISS\\s+Total' + ('\\s+' + NUM_PG).repeat(9);
const TRIBUTOS_REPART = ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ICMS', 'IPI', 'ISS', 'total'];
const lerRepart = (m, i0) => Object.fromEntries(TRIBUTOS_REPART.map((k, i) => [k, pgNum(m[i0 + i])]));

// Tipo da atividade pelo texto do bloco "Valor do Débito por Tributo para a Atividade".
// Revenda → Comércio (Anexo I); mercadoria industrializada pelo contribuinte → Indústria
// (Anexo II) — LC 123, art. 18, § 4º, I e II. Sem padrão conhecido → null (sem certeza).
const tipoAtividadePGDAS = (desc) => /Revenda\s+de\s+mercadorias/i.test(desc) ? 'Comércio'
    : /Venda\s+de\s+mercadorias\s+industrializadas/i.test(desc) ? 'Indústria'
        : /Presta[çc][ãa]o\s+de\s+servi[çc]os|Loca[çc][ãa]o\s+de\s+bens|servi[çc]os/i.test(desc) ? 'Serviços'
            : null;

// Números de uma linha do quadro 2.1 (Mercado Interno | Mercado Externo | Total): só o que
// está entre o rótulo e o PRÓXIMO rótulo. Linha vazia no PDF (ex.: RBT12p de quem não está
// em início de atividade) devolve [] — antes o regex "pulava" para a linha seguinte e a
// RBT12p saía com o valor da RBA. Sem o próximo rótulo → undefined (layout desconhecido).
const linhaQuadro21 = (T, rotulo) => {
    const m = T.match(new RegExp(rotulo + '([\\s\\S]*?)(?:Receita\\s+bruta\\s+acumulada|Limite\\s+de\\s+receita|2\\.2\\))', 'i'));
    return m ? (m[1].match(/[\d.]+,\d{2}/g) || []) : undefined;
};
// Valor da linha: a coluna "Total" (3ª) quando há as três; senão o único valor.
const totalLinha = (nums) => (nums && nums.length) ? nums[nums.length >= 3 ? 2 : 0] : undefined;

export function parsePGDASD(texto) {
    const res = { ok: false };
    if (!/Simples\s+Nacional|Per[ií]odo\s+de\s+Apura|PGDAS|Documento\s+de\s+Arrecada/i.test(texto)) { res.error = 'O arquivo não parece ser um PGDAS-D.'; return res; }
    const T = String(texto).replace(RODAPE_PGDAS, '\n');
    const g = (re) => { const m = T.match(re); return m; };
    const cnpj = g(/CNPJ\s+Matriz:\s*([\d.]+\/\d{4}-\d{2})/i);
    const nome = g(/Nome\s+empresarial:\s*([\s\S]*?)\s*Data\s+de\s+abertura/i);
    // "Período de Apuração: 01/07/2026 a 31/07/2026" ou "Período de Apuração (PA): 12/2025"
    const comp = g(/Per[ií]odo\s+de\s+Apura[çc][ãa]o(?:\s*\(PA\))?:\s*(?:\d{2}\/)?(\d{2})\/(\d{4})/i);
    const abertura = g(/Data\s+de\s+abertura(?:\s+no\s+CNPJ)?:\s*\d{2}\/(\d{2})\/(\d{4})/i);
    // Quadro 2.1: RPA e RBT12 pela coluna Total; fallback para layouts sem o rótulo seguinte.
    const rpaOld = g(/RPA\)[\s\S]*?Compet[êe]ncia\s*([\d.]+,\d{2})/i);
    const rpa = totalLinha(linhaQuadro21(T, '\\(RPA\\)\\s*-\\s*Compet[êe]ncia')) || (rpaOld && rpaOld[1]);
    const rbt12Old = g(/\(RBT12\)[^\d]*?([\d.]+,\d{2})/);
    const rbt12 = totalLinha(linhaQuadro21(T, '\\(RBT12\\)')) || (rbt12Old && rbt12Old[1]);
    // RBT12p: só os números da PRÓPRIA linha (vazia para empresa com 12+ meses).
    const rbt12p = totalLinha(linhaQuadro21(T, '\\(RBT12p\\)'));
    const folha = g(/Total\s+de\s+Folhas\s+de\s+Sal[áa]rios\s+Anteriores[\s\S]*?R\$\s*([\d.]+,\d{2})/i);
    const anexoSuj = g(/Sujeitos?\s+ao\s+Anexo\s+([IVX]+)/i);
    // Alguns PGDAS trazem o anexo só na descrição da atividade ("...tributados pelo
    // Anexo III...") — sem isso, empresas do Anexo III por natureza importavam sem anexo
    // e o DAS não calculava. Cobre "tributad(o/a)s pelo Anexo X" e "Anexo X" avulso.
    const anexoTrib = g(/tributad[oa]s?\s+pel[oa]\s+Anexo\s+([IVX]+)/i) || g(/\bAnexo\s+(I{1,3}|IV|V)\b/i);
    const fator = g(/Fator\s+r\s*=\s*(N[ãa]o\s+se\s+aplica|[\d,]+)(?:\s*[-–—]\s*(Anexo\s+[IVX]+))?/i);
    // ===== Débito declarado e repartição por tributo (segregação do DAS) =====
    // Fonte principal: "2.8) Total Geral da Empresa — Total do Débito Declarado (exigível +
    // suspenso)": soma TODAS as atividades e estabelecimentos. Antes a repartição era a 1ª
    // tabela do PDF (só a 1ª atividade) e, com o rodapé no meio do resumo, o DAS também.
    const i28 = T.search(/2\.8\)\s*Total\s+Geral\s+da\s+Empresa/i);
    const tg = i28 >= 0 ? T.slice(i28).match(new RegExp('Total\\s+do\\s+D[ée]bito\\s+Declarado[\\s\\S]{0,80}?' + TAB_TRIBUTOS, 'i')) : null;
    // Sem o 2.8: soma das tabelas por atividade (cada uma precedida de "Receita Bruta Informada")
    const atvTabs = [...T.matchAll(new RegExp('Receita\\s+Bruta\\s+Informada:\\s*R\\$\\s*' + NUM_PG + '\\s+' + TAB_TRIBUTOS, 'gi'))];
    let repart = null;
    if (tg) repart = { ...lerRepart(tg, 1), exata: true, fonte: 'total-geral' };
    else if (atvTabs.length) {
        repart = Object.fromEntries(TRIBUTOS_REPART.map(k => [k, 0]));
        atvTabs.forEach(m => { const r = lerRepart(m, 2); TRIBUTOS_REPART.forEach(k => { repart[k] += r[k]; }); });
        TRIBUTOS_REPART.forEach(k => { repart[k] = Math.round(repart[k] * 100) / 100; });
        repart = { ...repart, exata: true, fonte: 'atividades' };
    } else {
        // Layout sem as marcas acima: 1ª tabela encontrada — pode ser só uma atividade.
        const repM = g(new RegExp(TAB_TRIBUTOS, 'i'));
        if (repM) repart = { ...lerRepart(repM, 1), exata: false, fonte: 'tabela' };
    }
    // DAS declarado. No layout oficial ("2.6) Resumo da Declaração") o rótulo é a 2ª
    // coluna de uma tabela "Receita Bruta Auferida | Valor Total do Débito Declarado",
    // e os valores vêm NA ORDEM receita → DAS: o DAS é o 2º número. Pegar o 1º trazia
    // a receita como DAS (alíquota importada de 100%). Se o trecho detalhar
    // Principal/Multa/Juros, usa o valor rotulado "Total" — nunca o de multa/juros.
    let dasVal = tg ? tg[9] : null;
    const dasSeg = dasVal ? null : g(/(Receita\s+Bruta\s+Auferida[\s\S]{0,80}?)?Valor\s+Total\s+do\s+D[ée]bito\s+Declarado(?:\s*\(R\$\))?([\s\S]{0,140})/i);
    if (dasSeg) {
        const seg = dasSeg[2];
        const nums = seg.match(/[\d.]+,\d{2}/g) || [];
        const tot = /Multa|Juros/i.test(seg) && seg.match(/Total[^\d]{0,20}([\d.]+,\d{2})/i);
        if (tot) dasVal = tot[1];
        else if (dasSeg[1] && nums.length >= 2) dasVal = nums[1]; // tabela receita | DAS
        else dasVal = nums[0] || null;
    }
    // Município pode ter várias palavras ("ZE DOCA", "SANTA LUZIA DO PARUA") — o pdf.js
    // separa cada palavra por quebra de linha, que o regex antigo não aceitava.
    const mun = g(/Munic[íi]pio:\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'\s-]*?)\s*UF:\s*([A-Z]{2})/i);

    if (cnpj) res.cnpj = cnpj[1];
    if (nome) res.nome = nome[1].replace(/\s+/g, ' ').trim();
    if (comp) { res.compMonth = String(parseInt(comp[1])); res.compYear = comp[2]; res.competenceShort = comp[1] + '/' + comp[2]; }
    if (rpa) res.rpa = rpa;
    if (rbt12) res.rbt12 = rbt12;
    if (rbt12p) res.rbt12p = rbt12p;
    if (folha) res.folha12m = folha[1];
    if (fator) { res.fatorR = fator[1].replace(/\s+/g, ' ').trim(); if (fator[2]) res.anexo = fator[2].replace(/\s+/g, ' ').trim(); }
    if (!res.anexo && anexoSuj) res.anexo = 'Anexo ' + anexoSuj[1].toUpperCase();
    if (!res.anexo && anexoTrib) res.anexo = 'Anexo ' + anexoTrib[1].toUpperCase();

    // ===== Atividade pelos blocos de atividade do PGDAS-D =====
    // Antes a busca era no texto inteiro e o padrão era "Serviços" — 104 de 107 PGDAS de
    // comércio viravam Serviços. Agora: só revenda → Comércio; só industrializada →
    // Indústria; comércio + indústria → a de maior receita; serviços + mercadorias →
    // 'Ambos'. Sem blocos reconhecíveis fica sem atividade (a tela mantém a do cadastro).
    const blocos = [...T.matchAll(/Valor\s+do\s+D[ée]bito\s+por\s+Tributo\s+para\s+a\s+Atividade\s*\(R\$\):\s*([\s\S]*?)Receita\s+Bruta\s+Informada:\s*R\$\s*([\d.]+,\d{2})/gi)];
    if (blocos.length) {
        res.atividades = blocos.map(b => ({ descricao: b[1].replace(/\s+/g, ' ').trim(), receita: pgNum(b[2]), tipo: tipoAtividadePGDAS(b[1]) }));
        const tipos = new Set(res.atividades.map(a => a.tipo));
        if (!tipos.has(null)) {
            if (tipos.has('Serviços') && tipos.size > 1) res.atividade = 'Ambos';
            else if (tipos.size === 1) res.atividade = [...tipos][0];
            else {
                const soma = (t) => res.atividades.filter(a => a.tipo === t).reduce((s, a) => s + a.receita, 0);
                res.atividade = soma('Indústria') > soma('Comércio') ? 'Indústria' : 'Comércio';
            }
            // Anexo pela natureza da atividade quando o PDF não o cita (comércio/indústria
            // não trazem "Anexo" no texto). Só com um único anexo possível.
            if (!res.anexo && tipos.size === 1 && !tipos.has('Serviços')) res.anexo = tipos.has('Comércio') ? 'Anexo I' : 'Anexo II';
        }
    } else if (/Revenda\s+de\s+mercadorias/i.test(T)) res.atividade = 'Comércio';
    else if (/Presta[çc][ãa]o\s+de\s+Servi[çc]os/i.test(T)) res.atividade = 'Serviços';
    // Sujeito ao Fator R: o PGDAS traz um Fator r NUMÉRICO (não "Não se aplica")
    // ou classifica a atividade no Anexo V. Nesses casos o anexo-BASE é o V; a
    // migração para o III é DERIVADA quando o Fator R ≥ 28% — não gravamos o III
    // direto (era o que fazia o sistema "esquecer" que é empresa de Fator R e
    // não reconhecer a economia III × V).
    const fatorAplica = !!(fator && !/N[ãa]o\s+se\s+aplica/i.test(fator[1]));
    const classificadoV = /Anexo\s+V\b/i.test(res.anexo || '') || (anexoSuj && /^V$/i.test(anexoSuj[1]));
    if (fatorAplica || classificadoV) {
        res.sujeitoFatorR = true;
        res.anexo = 'Anexo V'; // base natural; efetivo (III se Fator R ≥ 28%) é derivado
    } else if (res.anexo) {
        res.sujeitoFatorR = false; // Anexo III por natureza (contabilidade, escola…) — não migra
    }
    if (dasVal) res.das = dasVal;
    if (abertura) res.dataAbertura = abertura[1] + '/' + abertura[2];
    if (mun) res.municipio = mun[1].replace(/\s+/g, ' ').trim() + '/' + mun[2].toUpperCase();
    if (repart) res.repart = repart;
    // Sem o 2.8 e sem o resumo legível, o total da repartição é o valor DECLARADO.
    if (!res.das && res.repart && res.repart.total > 0) res.das = formatBRLDisplay(res.repart.total);
    // Folha de Salários Anteriores (12m) — soma dos meses quando houver (senão "Nenhuma")
    const folhaBlock = T.match(/2\.3\)[^]*?(?:2\.4\)|2\.5\)|$)/);
    if (!res.folha12m && folhaBlock && !/Nenhuma/i.test(folhaBlock[0])) {
        let soma = 0; const rf = /(\d{2}\/\d{4})\s+([\d.]+,\d{2})/g; let mf;
        while ((mf = rf.exec(folhaBlock[0]))) soma += pgNum(mf[2]);
        if (soma > 0) res.folha12m = soma.toFixed(2).replace('.', ',');
    }
    // Mais de um estabelecimento: os valores capturados podem ser só da matriz — avisar o usuário.
    // Detecta por CNPJs DISTINTOS (filiais de verdade), não pela palavra "Estabelecimento"
    // (que pode aparecer várias vezes no layout mesmo com um único estabelecimento).
    const cnpjsDistintos = new Set(T.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || []);
    if (cnpjsDistintos.size > 1) res.multiEstab = true;

    // Evolução do faturamento — 2.2.1 (Mercado Interno) + 2.2.2 (Mercado Externo): a receita
    // bruta do mês é a soma dos dois (mesmo critério da coluna Total do quadro 2.1).
    const ev = {};
    [/2\.2\.1\)[^]*?(?:2\.2\.2\)|2\.3\)|$)/, /2\.2\.2\)[^]*?(?:2\.3\)|$)/].forEach((reBloco) => {
        const block = T.match(reBloco);
        if (!block) return;
        const re = /(\d{2}\/\d{4})\s+([\d.]+,\d{2})/g; let m;
        while ((m = re.exec(block[0]))) ev[m[1]] = (ev[m[1]] || 0) + pgNum(m[2]);
    });
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

// Atividades que a tela oferece no Simples Nacional ('Ambos' só existe no MEI).
export const ATIVIDADES_SN = ['Serviços', 'Comércio', 'Indústria'];

/**
 * Aplica um PGDAS-D lido (parsePGDASD) sobre os dados da tela. Com empresa selecionada,
 * nome/CNPJ do cadastro prevalecem. A atividade só é trocada quando o PDF a define com
 * certeza e ela existe no Simples — senão fica a do cadastro (antes virava "Serviços").
 */
export const aplicarPgdasD = (prev, d) => {
    const atividadePdf = d.atividade && ATIVIDADES_SN.includes(d.atividade) ? d.atividade : null;
    const next = {
        ...prev,
        clientName: prev.clientId ? (prev.clientName || d.nome) : (d.nome || prev.clientName),
        cnpj: prev.clientId ? (prev.cnpj || d.cnpj) : (d.cnpj || prev.cnpj),
        regime: 'Simples Nacional',
        atividade: atividadePdf || prev.atividade || 'Serviços',
        anexo: d.anexo || prev.anexo,
        // Fator R: quando o PGDAS indica atividade sujeita, gravamos o
        // anexo-base V (a migração p/ III vem do Fator R ≥ 28%) e já
        // ligamos a economia III × V no relatório.
        sujeitoFatorR: d.sujeitoFatorR !== undefined ? d.sujeitoFatorR : prev.sujeitoFatorR,
        mostrarEconomiaFatorR: d.sujeitoFatorR ? true : prev.mostrarEconomiaFatorR,
        compMonth: d.compMonth || prev.compMonth,
        compYear: d.compYear || prev.compYear,
        competenceShort: d.competenceShort || prev.competenceShort,
        competence: d.compMonth ? (MONTHS[parseInt(d.compMonth) - 1] + '/' + d.compYear) : prev.competence,
        revenue: d.rpa || prev.revenue,
        rbt12: d.rbt12 || prev.rbt12,
        rbt12p: d.rbt12p || '',
        dataAbertura: d.dataAbertura || prev.dataAbertura,
        // "Nenhuma" folha no PDF não herda a folha da empresa/mês anterior (mudaria o Fator R)
        folha12m: d.folha12m || '',
        municipio: d.municipio || prev.municipio,
        evolucao: d.evolucao || prev.evolucao || null,
        // PGDAS-D é a fonte da verdade: DAS declarado e a segregação por tributo
        dasOfficial: d.das || '',
        repartManual: d.repart || null,
        fatorRInfo: d.fatorR || '',
    };
    delete next.revenueRetained; delete next.revenueNonRetained;
    return next;
};

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
    // ===== IRPJ/CSLL: perfil de apuração =====
    //  · Mensal (antecipado) e Estimativa (Lucro Real anual): base = receita do MÊS
    //    (Lei 9.430, art. 2º) e adicional sobre o que passar de R$ 20 mil.
    //  · Trimestral (LP): meses comuns = provisão sobre a receita do mês; no fechamento
    //    (mar/jun/set/dez) o DARF usa a receita acumulada do trimestre (periodRevenue)
    //    e abate as retenções do trimestre inteiro (periodRevenueRetained).
    //  · Trimestral no Lucro Real: o IRPJ/CSLL sai do lucro real (contábil ajustado),
    //    não de presunção — só usa o valor informado (irpjRealApurado/csllRealApurado).
    const irpjMode = data.irpjCsllMode;
    const mesComp = parseInt(data.compMonth);
    const isTrimestral = irpjMode === 'Trimestral (Apuração)';
    const fechamentoTrim = isTrimestral && [3, 6, 9, 12].includes(mesComp);
    const realTrimestral = data.regime === 'Lucro Real' && isTrimestral;
    const periodoRevenue = parseNumBR(data.periodRevenue);
    const usaAcumulado = fechamentoTrim && !realTrimestral && periodoRevenue > 0;
    const periodoRetido = parseNumBR(data.periodRevenueRetained);
    const baseRetIRCS = fechamentoTrim && periodoRetido > 0 ? periodoRetido : revComRetencao;
    const receitaEquip = data.equiparacaoHospitalar ? data.receitaEquiparacao : 0;
    const isComercioInd = atividade === 'Comércio' || atividade === 'Indústria';
    const isLPouReal = data.regime === 'Lucro Presumido' || data.regime === 'Lucro Real';
    const comercioLP = isLPouReal && isComercioInd;

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
                    // Receita sem incidência de PIS/COFINS (CST 04 monofásico, 05 ST, 06 alíq. zero,
                    // 09 suspensão) sai da base cumulativa. Conceito de comércio/indústria — não abate
                    // em serviços (onde o campo nem aparece).
                    const semPC = isComercioInd ? parseNumBR(data.receitaMonofasica) : 0;
                    const basePC = Math.max(0, totalRevenue - semPC);
                    updated.base = totalRevenue > 0 ? formatBRLDisplay(basePC) : "";
                    updated.obs = semPC > 0 ? 'Base sem receita CST 04/05/06/09 (− ' + formatBRLDisplay(semPC) + ')' : (updated.obs || 'Regime cumulativo');
                } else {
                    updated.base = totalRevenue > 0 ? formatBRLDisplay(totalRevenue) : "";
                }
            } else if (basePres.includes(t.tax) && isRegimeNormal) {
                if (realTrimestral) {
                    updated.base = "";
                } else {
                    const baseRevenueToUse = usaAcumulado ? periodoRevenue : totalRevenue;
                    updated.base = baseRevenueToUse > 0 ? formatBRLDisplay(getBasePresumidaLP(baseRevenueToUse, t.tax, atividade, irpjMode, receitaEquip)) : "";
                }
            } else if (baseCPP.includes(t.tax)) {
                const totalFolhaEProLabore = proLabore + folhaMensal;
                updated.base = totalFolhaEProLabore > 0 ? formatBRLDisplay(totalFolhaEProLabore) : "";
            } else if (baseFolhaEmp.includes(t.tax)) {
                updated.base = folhaMensal > 0 ? formatBRLDisplay(folhaMensal) : "";
            }
            
            if (data.regime === 'Lucro Real' && !t.rateManual) {
                if (t.tax === 'PIS' && updated.rate === '0,65') { updated.rate = '1,65'; updated.obs = OBS_NAO_CUMULATIVO; }
                if (t.tax === 'COFINS' && updated.rate === '3,00') { updated.rate = '7,60'; updated.obs = OBS_NAO_CUMULATIVO; }
            }

            const b = parseNumBR(updated.base);
            const r = parseNumBR(updated.rate);
            
            if (b > 0 && r > 0) {
                updated.apurado = formatBRLDisplay(b * r / 100);
            } else {
                updated.apurado = "";
            }

            // Fechamento do trimestre: apurado = trimestre inteiro, mas a carga do mês
            // considera só a receita do mês (mesma conta da provisão dos meses comuns).
            updated.cargaMes = undefined;
            if (basePres.includes(t.tax) && isRegimeNormal && usaAcumulado) {
                const baseMes = totalRevenue > 0 ? getBasePresumidaLP(totalRevenue, t.tax, atividade, irpjMode, receitaEquip) : 0;
                updated.cargaMes = formatBRLDisplay(baseMes * r / 100);
            }
            if (basePres.includes(t.tax) && realTrimestral) {
                const informado = t.tax === 'IRPJ' ? parseNumBR(data.irpjRealApurado)
                    : t.tax === 'CSLL' ? parseNumBR(data.csllRealApurado) : 0;
                updated.apurado = informado > 0 ? formatBRLDisplay(informado) : "";
            }

            // FAP (Fator Acidentário de Prevenção) multiplica o RAT: RAT Ajustado = RAT × FAP.
            // Faixa legal 0,5–2,0 (Decreto 3.048/99, art. 202-A): fora dela é erro de digitação
            // (ex.: "1.2345" virando 12345) — limita e sinaliza.
            if (t.tax === 'RAT' || t.tax === 'RAT (Ajustado)') {
                // Observação de um FAP anterior não pode sobreviver ao valor corrigido
                if (/× FAP/.test(updated.obs || '')) updated.obs = 'Risco Ambiental do Trabalho';
                const fapInf = parseNumBR(data.fap);
                if (fapInf > 0 && b > 0 && r > 0) {
                    const fap = Math.min(2, Math.max(0.5, fapInf));
                    const fora = fap !== fapInf;
                    if (fap !== 1 || fora) {
                        updated.apurado = formatBRLDisplay(b * (r * fap) / 100);
                        updated.obs = 'RAT ' + r.toFixed(2).replace('.', ',') + '% × FAP ' + fap.toFixed(4).replace('.', ',')
                            + (fora ? ' · FAP informado (' + String(data.fap) + ') fora da faixa 0,5–2,0 — limitado' : '');
                    }
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
                // Dois perfis de cliente:
                //  · Trimestral (recolhe no fechamento): meses comuns = PROVISÃO informativa
                //    (fora do caixa do mês); no fechamento (mar/jun/set/dez) vira guia real.
                //  · Mensal (antecipado) / Estimativa: recolhe todo mês → guia real.
                if (realTrimestral) {
                    updated.provisao = !fechamentoTrim;
                    updated.obs = t.tax === 'Adicional IRPJ'
                        ? "Lucro Real trimestral: incluído no IRPJ apurado informado"
                        : parseNumBR(updated.apurado) > 0
                            ? "Lucro Real trimestral — valor apurado sobre o lucro real (informado)"
                            : "Lucro Real trimestral: informe o IRPJ/CSLL apurado sobre o lucro real (a presunção não se aplica)";
                } else if (isTrimestral) {
                    updated.provisao = !fechamentoTrim;
                    updated.obs = fechamentoTrim
                        ? (usaAcumulado ? "Apuração do trimestre (receita acumulada) — recolher no vencimento" : "Apuração do trimestre — recolher no vencimento")
                        : "Provisão do mês — recolhe no fechamento do trimestre";
                } else if (data.irpjCsllMode === 'Estimativa (Anual)') {
                    updated.provisao = false;
                    updated.obs = "Estimativa mensal (Lucro Real Anual)";
                } else {
                    updated.provisao = false;
                    updated.obs = "Recolhimento mensal (antecipado)";
                }
            }

            if (isRegimeNormal && atividade === 'Serviços' && !t.retidoManual) {
                // IRPJ (1,5%) e CSLL (1%) retidos no TRIMESTRE abatem o DARF do fechamento;
                // PIS/COFINS/ISS retidos compensam a guia do próprio mês.
                if (t.tax === 'CSLL') updated.retido = baseRetIRCS > 0 ? formatBRLDisplay(baseRetIRCS * 0.01) : "";
                else if (t.tax === 'IRPJ') updated.retido = baseRetIRCS > 0 ? formatBRLDisplay(baseRetIRCS * 0.015) : "";
                else if (revComRetencao > 0) {
                    if (t.tax === 'PIS') updated.retido = formatBRLDisplay(revComRetencao * 0.0065);
                    else if (t.tax === 'COFINS') updated.retido = formatBRLDisplay(revComRetencao * 0.03);
                    else if (t.tax === 'ISS') updated.retido = formatBRLDisplay(revComRetencao * (parseNumBR(t.rate) / 100));
                } else {
                    updated.retido = "";
                }
            }
        }

        // ===== Estaduais do comércio (LP/Real): ICMS por débito/crédito e FUMACOP (2%) =====
        // Antecipação Parcial e DIFAL são linhas de valor manual — não recalculadas aqui.
        // ===== Comércio/Indústria (LP/Real): guias estaduais LANÇADAS (valor pronto, não calculado) =====
        // ICMS próprio vem do SPED; ICMS-ST/DIFAL/Antecipação/FUMACOP são valores informados
        // (já apurados em guia própria/GNRE). A estimativa por débito/crédito foi removida.
        if (comercioLP) {
            const lancar = (valorField, obs) => {
                const v = parseNumBR(data[valorField]);
                updated.base = ""; updated.rate = "";
                updated.apurado = v > 0 ? formatBRLDisplay(v) : "";
                updated.obs = obs;
            };
            if (t.tax === 'ICMS') lancar('icmsApurado', 'ICMS próprio apurado no SPED/EFD');
            else if (t.tax === 'ICMS (ST)') lancar('icmsStValor', 'ICMS-ST recolhido como substituto tributário');
            else if (t.tax === 'DIFAL') lancar('difalValor', 'Diferencial de alíquota (compras interestaduais)');
            else if (t.tax === 'Antecipação Parcial') lancar('antecipacaoValor', 'Antecipação parcial de ICMS (entrada interestadual)');
            else if (t.tax === 'FUMACOP') lancar('fumacopValor', 'Adicional FUMACOP — Lei 8.205/2004 (MA)');
        }

        if (data.regime === 'Simples Nacional') {
            if (t.tax === 'DAS') {
                const dasOficial = parseNumBR(data.dasOfficial);
                // RBT12 proporcionalizada (empresa < 12 meses) manda na alíquota E no Fator R:
                // a informada (PGDAS-D) ou, sem ela, a calculada pelo art. 22 da Res. CGSN 140.
                const rbt12pInf = parseNumBR(data.rbt12p);
                const rbtInicio = rbt12 <= 0 && !(rbt12pInf > 0) ? rbt12InicioAtividade(data) : null;
                const rbtAliq = rbt12pInf > 0 ? rbt12pInf : (rbtInicio !== null ? rbtInicio : rbt12);
                // Folha no mesmo período da receita (proporcionalizada em início de atividade)
                const folhaFR = folhaFatorR(data);
                if (dasOficial > 0) {
                    // Importado do PGDAS-D: o valor DECLARADO é a fonte da verdade — não recalcula
                    updated.base = formatBRLDisplay(totalRevenue);
                    updated.rate = totalRevenue > 0 ? (dasOficial / totalRevenue * 100).toFixed(4).replace('.', ',') : '';
                    updated.apurado = formatBRLDisplay(dasOficial);
                    // Mostra o anexo EFETIVO (III quando o Fator R ≥ 28%), não o
                    // base V — o valor em si é o declarado, fonte da verdade.
                    const anexoEfDAS = data.anexo ? getAnexoEfetivo(data.anexo, calcFatorR(folhaFR, rbtAliq), sujeitoFatorR) : '';
                    updated.obs = 'Importado do PGDAS-D — valor declarado' + (anexoEfDAS ? ' · ' + anexoEfDAS : '');
                } else if (totalRevenue > 0 && data.anexo) {
                    // rbtAliq pode ser 0 (empresa nova sem RBT12): cai na 1ª faixa (ver
                    // calcAliquotaEfetivaSN). Sem este caminho o DAS ficava em branco —
                    // "não gera imposto" no relatório de empresas recém-abertas.
                    const fR = calcFatorR(folhaFR, rbtAliq);
                    const anexoEf = getAnexoEfetivo(data.anexo, fR, sujeitoFatorR);
                    const res = calcAliquotaEfetivaSN(rbtAliq, anexoEf);

                    updated.base = formatBRLDisplay(totalRevenue);
                    updated.rate = res.rate.toFixed(4).replace('.', ',');

                    const apuradoDAS = totalRevenue * res.rate / 100;
                    updated.apurado = formatBRLDisplay(apuradoDAS);
                    let obsDAS = `${anexoEf} (Faixa ${res.faixa}) — Alíq. Nom. ${res.nominal.toFixed(2).replace('.', ',')}%`;
                    if (rbtAliq <= 0) obsDAS += ' · sem RBT12 — 1ª faixa. Importe o PGDAS-D para o valor exato.';
                    else if (rbt12pInf > 0) obsDAS += ' · sobre RBT12p (proporcionalizado)';
                    else if (rbtInicio !== null) obsDAS += ' · início de atividade: RBT12p ' + formatBRLDisplay(rbtInicio) + ' (Res. CGSN 140, art. 22)';
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

        // FGTS no Simples (Anexo III/V): 8% sobre a folha de empregados, devido à parte
        // (o DAS não inclui FGTS). Anexo IV e LP/Real já caem no ramo baseFolhaEmp acima.
        if (t.tax === 'FGTS' && data.regime === 'Simples Nacional' && !isAnexoIV) {
            const r = parseNumBR(updated.rate) || 8;
            if (!(parseNumBR(updated.rate) > 0)) updated.rate = '8,00';
            updated.base = folhaMensal > 0 ? formatBRLDisplay(folhaMensal) : '';
            updated.apurado = folhaMensal > 0 ? formatBRLDisplay(folhaMensal * r / 100) : '';
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

        // ===== Locks manuais: respeita o que o usuário digitou na tabela =====
        // Campos travados (base/alíq/apurado/valor) NÃO são sobrescritos pelo recálculo —
        // some a necessidade de "apertar Recalcular". `retido` já é protegido por retidoManual.
        // As flags são carregadas adiante para sobreviver a salvar/reabrir a competência.
        if (t.baseManual) updated.base = t.base;
        if (t.rateManual) updated.rate = t.rate;
        if (t.apuradoManual) updated.apurado = t.apurado;
        updated.baseManual = !!t.baseManual;
        updated.rateManual = !!t.rateManual;
        updated.apuradoManual = !!t.apuradoManual;
        updated.valueManual = !!t.valueManual;

        const apurado = parseNumBR(updated.apurado);
        const retido = parseNumBR(updated.retido);
        // Tributos gerenciados pelo motor têm o valor recalculado/limpo; linhas customizadas
        // (nome livre, só "Valor" digitado) preservam o que o usuário digitou
        const MANAGED = ['PIS', 'COFINS', 'PIS/COFINS', 'ISS', 'IRPJ', 'CSLL', 'Adicional IRPJ', 'CPP', 'CPP (Patronal)', 'RAT', 'RAT (Ajustado)', 'Terceiros', 'FGTS', 'DAS', 'INSS', 'INSS (Sócio)', 'ICMS', 'ICMS (ST)', 'DIFAL', 'Antecipação Parcial', 'FUMACOP', 'IRRF'];
        if (t.valueManual) {
            updated.value = t.value; // "A pagar" fixado à mão
        } else if (apurado > 0 || retido > 0) {
            updated.value = formatBRLDisplay(Math.max(0, apurado - retido));
        } else if (MANAGED.includes(t.tax)) {
            updated.value = "";
        }

        // Vencimento: automático por tipo, mas EDITÁVEL — data ajustada à mão (dueDateManual)
        // sobrevive ao recálculo (regimes especiais/TARE/GNRE fogem do dia fixo).
        updated.dueDateManual = !!t.dueDateManual;
        if (!t.dueDateManual && data.compMonth && data.compYear && t.tax) {
            const due = getDueDate(data.compMonth, data.compYear, t.tax, data.irpjCsllMode);
            if (due) updated.dueDate = due;
            else if (['IRPJ', 'CSLL', 'Adicional IRPJ'].includes(t.tax) && data.irpjCsllMode === 'Trimestral (Apuração)') updated.dueDate = '';
        }

        return updated;
    });
};

/**
 * Receita de 12 meses usada no Fator R e na alíquota do Simples: a RBT12p informada
 * (PGDAS-D), a de início de atividade (art. 22) ou a RBT12 normal. Fonte única p/
 * tela, relatório e motor — antes o Fator R usava sempre a RBT12 (0 em empresa nova).
 */
export const rbtFatorR = (data) => {
    const p = parseNumBR(data && data.rbt12p);
    if (p > 0) return p;
    const r = parseNumBR(data && data.rbt12);
    if (r > 0) return r;
    const ini = rbt12InicioAtividade(data);
    return ini !== null ? ini : 0;
};

/**
 * Folha de 12 meses (FS12) do Fator R no MESMO período da receita de rbtFatorR.
 * Em início de atividade a receita é proporcionalizada (RBT12p = média dos meses
 * anteriores × 12; no 1º mês, RPA × 12 — Res. CGSN 140/2018, art. 22) e a folha segue o
 * mesmo critério (art. 26): soma das folhas dos meses anteriores ÷ nº de meses × 12; no
 * 1º mês, folha + pró-labore do próprio PA × 12. Antes a folha ia crua (ex.: 3 meses)
 * contra a receita anualizada e o Fator R saía ~1/4 do real (Anexo V indevido).
 * Fora do início de atividade (ou sem data de abertura) = folha informada.
 */
export const folhaFatorR = (data) => {
    const folha12m = parseNumBR(data && (data.folha12m !== undefined ? data.folha12m : data.folha));
    const receitaProporcional = parseNumBR(data && data.rbt12p) > 0
        || (!(parseNumBR(data && data.rbt12) > 0) && rbt12InicioAtividade(data) !== null);
    if (!receitaProporcional) return folha12m;
    const meses = mesesInicioAtividade(data);
    if (meses === null) return folha12m;
    if (meses === 0) {
        const folhaPA = parseNumBR(data.folhaMensal !== undefined ? data.folhaMensal : data.folha) + sumProLabore(data);
        return (folhaPA > 0 ? folhaPA : folha12m) * 12;
    }
    return (folha12m / meses) * 12;
};

/** Fator R (%) com folha e receita no mesmo período — fonte única p/ motor, tela e relatório. */
export const fatorRDoPeriodo = (data) => calcFatorR(folhaFatorR(data), rbtFatorR(data));

/**
 * Economia gerada no mês (exibida no relatório e persistida no histórico):
 *  · Fator R (Simples, Anexo III efetivo): custo total no Anexo V com pró-labore
 *    mínimo − custo no Anexo III com o pró-labore atual (DAS + INSS + IRRF).
 *  · Equiparação hospitalar (LP/Real, serviços): IRPJ/CSLL a 32% − com a parcela
 *    equiparada a 8%/12%.
 * Retorna null quando não há economia real.
 */
export const calcEconomia = (clientData, taxes) => {
    const revenue = calculateTotalRevenue(clientData);
    const rbtFR = rbtFatorR(clientData);
    const fR = fatorRDoPeriodo(clientData);
    if ((clientData.sujeitoFatorR === true || clientData.mostrarEconomiaFatorR) && clientData.regime === 'Simples Nacional' && (clientData.anexo === 'Anexo III' || clientData.anexo === 'Anexo V') && rbtFR > 0 && fR >= 28) {
        const rateIII = calcAliquotaEfetivaSN(rbtFR, 'Anexo III').rate;
        const rateV = calcAliquotaEfetivaSN(rbtFR, 'Anexo V').rate;
        // DAS ancorado no REALMENTE apurado (Anexo III efetivo); o Anexo V é o
        // mesmo DAS reescalado pela razão das alíquotas efetivas V/III.
        const dasReal = parseNumBR(((taxes || []).find(t => t.tax === 'DAS') || {}).apurado);
        const dasIII = dasReal > 0 ? dasReal : revenue * rateIII / 100;
        const dasV = dasReal > 0 && rateIII > 0 ? dasReal * (rateV / rateIII) : revenue * rateV / 100;
        // Custo total de cada cenário inclui os tributos do pró-labore (INSS 11% até o
        // teto e IRRF); sem Fator R o sócio receberia 1 salário mínimo.
        const plAtual = sumProLabore(clientData);
        const inssCom = Math.min(plAtual, TETO_INSS) * 0.11;
        const irrfCom = calcIRRFProLabore(plAtual, inssCom).imposto;
        const custoCom = dasIII + inssCom + irrfCom;
        const inssSem = SALARIO_MINIMO * 0.11;
        const irrfSem = calcIRRFProLabore(SALARIO_MINIMO, inssSem).imposto;
        const custoSem = dasV + inssSem + irrfSem;
        if (custoSem - custoCom > 0) {
            return {
                tipo: 'Fator R',
                valor: custoSem - custoCom,
                semLabel: 'Sem Fator R · Anexo V (pró-labore mínimo)',
                comLabel: 'Com Fator R · Anexo III (pró-labore atual)',
                semVal: custoSem, comVal: custoCom,
                semExtra: `DAS ${formatCurrency(dasV)} + INSS ${formatCurrency(inssSem)} (1 salário mínimo)`,
                comExtra: `DAS ${formatCurrency(dasIII)} + INSS ${formatCurrency(inssCom)}${irrfCom > 0 ? ' + IRRF ' + formatCurrency(irrfCom) : ''}`,
                explica: `O custo total considera os tributos do pró-labore. Para atingir o Fator R (${fR.toFixed(1).replace('.', ',')}% ≥ 28%), o pró-labore de ${formatCurrency(plAtual)} gera INSS e IRRF; sem o Fator R, o sócio receberia 1 salário mínimo (${formatCurrency(SALARIO_MINIMO)}). A economia é a diferença entre o custo total no Anexo V (com pró-labore mínimo) e no Anexo III (com o pró-labore atual).`,
            };
        }
        return null;
    }
    if ((clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && clientData.equiparacaoHospitalar && (clientData.atividade || 'Serviços') === 'Serviços') {
        // Só o fechamento trimestral usa a receita acumulada (mesma regra do motor);
        // mensal e estimativa usam a receita do mês com limite de R$ 20 mil.
        const trimestral = clientData.irpjCsllMode === 'Trimestral (Apuração)';
        const fech = trimestral && [3, 6, 9, 12].includes(parseInt(clientData.compMonth));
        const baseRev = fech && parseNumBR(clientData.periodRevenue) > 0 ? parseNumBR(clientData.periodRevenue) : revenue;
        const eqRev = Math.min(Math.max(parseNumBR(clientData.receitaEquiparacao), 0), baseRev);
        const normRev = baseRev - eqRev;
        const adicLimit = trimestral ? 60000 : 20000;
        const baseIrpjSem = baseRev * 0.32, baseCsllSem = baseRev * 0.32;
        const semVal = (baseIrpjSem * 0.15) + (baseCsllSem * 0.09) + (Math.max(0, baseIrpjSem - adicLimit) * 0.10);
        const baseIrpjCom = eqRev * 0.08 + normRev * 0.32, baseCsllCom = eqRev * 0.12 + normRev * 0.32;
        const comVal = (baseIrpjCom * 0.15) + (baseCsllCom * 0.09) + (Math.max(0, baseIrpjCom - adicLimit) * 0.10);
        if (eqRev > 0 && semVal - comVal > 0) {
            return {
                tipo: 'Equiparação Hospitalar',
                valor: semVal - comVal,
                semLabel: 'Sem equiparação · tudo a 32%',
                comLabel: 'Com equiparação · parcial',
                semVal, comVal,
                semExtra: `IRPJ e CSLL sobre 32% de ${formatCurrency(baseRev)}`,
                comExtra: `${formatCurrency(eqRev)} a 8%/12% + ${formatCurrency(normRev)} a 32%`,
                explica: `Apenas ${formatCurrency(eqRev)} da receita se enquadra na equiparação (presunção 8% IRPJ / 12% CSLL); o restante (${formatCurrency(normRev)}) segue a 32%. A economia é a diferença na base de IRPJ e CSLL sobre a parcela equiparada.`,
            };
        }
    }
    return null;
};

export const STORAGE_KEY = 'sete-apuracao-draft';
