"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    Printer, Plus, Trash2, FileCheck, Eye, Edit3,
    DollarSign, Calculator, TrendingUp, BookOpen, Info,
    Landmark, Building2, Receipt, BadgePercent, Scale, Save,
    Calendar, FileText, Phone, Mail, AlertTriangle, ArrowRight, CheckCircle2, XCircle,
    MessageSquare, ChevronDown
} from 'lucide-react';
import {
    DEFAULT_TAXES, DEFAULT_TAXES_LP, DEFAULT_TAXES_MEI_AMBOS, DEFAULT_TAXES_MEI_COMERCIO, DEFAULT_TAXES_MEI_SERVICOS, DEFAULT_TAXES_SN_COMERCIO, DEFAULT_TAXES_SN_SERVICOS, GLOSSARY, MONTHS, OFFICE_NAME, STORAGE_KEY, autoFillTaxes, calcAliquotaEfetivaSN, calcComercioLP, calcFatorR, calculateTotalRevenue, extractPdfText, formatBRLDisplay, formatCNPJ, formatCurrency, formatPercent, getAnexoEfetivo, getDueDate, isSujeitoFatorR, lpDefaults, parseNumBR, parsePGDASD, pgNum, sumProLabore, SUBLIMITE_SN, LIMITE_SN
} from './engine.js';
// ---- Integração com o controle fiscal (teste-controle) ----
import { useData } from '@/contexts/data-context';
import { TAX_REGIME_LABELS } from '@/lib/types';
import { getApuracoes, saveApuracao, deleteApuracao } from '@/features/apuracao/services';
// ---- Componentes de UI do app (para o módulo ter a cara do controle fiscal) ----
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const BrandIcon = () => (
    <svg viewBox="0 0 80.7 103.3" fill="#F79C04" fillRule="evenodd" role="img" aria-label="SETE" style={{ height: 46, width: 'auto', display: 'block', flexShrink: 0 }}>
        <path d="M47.06 64.0 C46.87 63.83 49.08 60.12 49.35 59.42 C53.43 48.72 51.97 37.5 45.31 28.27 C46.82 28.83 48.15 29.69 49.45 30.62 C57.78 36.55 59.91 48.35 54.89 57.22 C54.17 58.5 48.53 65.29 47.06 64.0 M31.74 59.42 C32.01 60.12 34.23 63.83 34.04 64.0 C32.56 65.29 26.93 58.5 26.2 57.22 C21.18 48.35 23.32 36.55 31.64 30.62 C32.94 29.69 34.28 28.83 35.78 28.27 C29.12 37.5 27.66 48.72 31.74 59.42 M48.32 28.0 L48.4 27.1 C48.47 26.21 48.11 25.34 47.43 24.77 L40.55 24.77 L40.54 24.77 L33.66 24.77 C32.98 25.34 32.62 26.21 32.7 27.1 L32.78 28.0 C19.27 34.53 17.29 52.07 27.67 62.5 C28.3 63.14 31.53 65.05 31.67 65.25 C32.12 65.87 31.8 67.76 32.29 68.63 C32.36 68.76 34.27 70.69 34.4 70.76 C35.15 71.2 37.27 71.65 37.55 70.37 C37.6 70.09 37.54 64.97 37.5 64.69 C37.4 64.17 35.45 61.47 35.1 60.56 C30.81 49.45 31.27 38.15 38.66 28.52 L39.16 64.01 L40.54 64.01 L40.55 64.01 L40.55 64.01 L41.94 64.01 L42.44 28.52 C49.83 38.15 50.28 49.45 45.99 60.56 C45.64 61.47 43.69 64.17 43.6 64.69 C43.55 64.97 43.49 70.09 43.55 70.37 C43.83 71.65 45.95 71.2 46.69 70.76 C46.82 70.69 48.73 68.76 48.81 68.63 C49.3 67.76 48.98 65.87 49.43 65.25 C49.57 65.05 52.79 63.14 53.43 62.5 C63.81 52.07 61.82 34.53 48.32 28.0" />
        <path d="M76.3 73.51 C75.69 78.23 71.24 81.29 67.05 82.5 C69.66 80.22 71.9 77.41 73.16 74.15 C74.9 57.0 73.14 39.41 73.79 22.16 C73.81 21.83 73.84 19.91 73.91 19.82 C74.09 19.6 74.56 20.28 74.64 20.35 C75.27 20.88 76.31 21.69 76.4 22.51 L76.3 73.51 M52.06 91.7 C48.42 94.31 44.48 96.39 40.78 98.99 C40.72 98.95 40.65 98.91 40.58 98.87 L40.58 98.86 C40.58 98.86 40.57 98.86 40.57 98.86 C40.57 98.86 40.57 98.86 40.57 98.86 L40.57 98.87 C40.5 98.91 40.43 98.95 40.36 98.99 C36.67 96.39 32.73 94.31 29.09 91.7 C22.64 87.08 10.53 78.28 9.97 69.99 L9.99 17.62 L15.13 14.1 L15.01 69.18 C15.44 77.68 18.58 82.18 26.2 85.67 C27.97 86.48 30.69 87.02 32.19 87.78 C33.11 88.24 37.79 92.59 38.99 93.63 C39.15 93.77 40.33 95.2 40.46 95.21 C40.48 95.21 40.52 95.18 40.57 95.14 C40.63 95.18 40.67 95.21 40.68 95.21 C40.81 95.2 42.0 93.77 42.15 93.63 C43.36 92.59 48.04 88.24 48.96 87.78 C50.46 87.02 53.18 86.48 54.95 85.67 C62.57 82.18 65.7 77.68 66.14 69.18 L66.02 14.1 L71.16 17.62 L71.17 69.99 C70.61 78.28 58.51 87.08 52.06 91.7 M4.85 73.51 L4.74 22.51 C4.83 21.69 5.88 20.88 6.5 20.35 C6.59 20.28 7.06 19.6 7.23 19.82 C7.31 19.91 7.34 21.83 7.35 22.16 C8.0 39.41 6.25 57.0 7.98 74.15 C9.25 77.41 11.49 80.22 14.1 82.5 C9.91 81.29 5.46 78.23 4.85 73.51 M17.8 12.5 C22.69 10.02 27.8 7.86 33.08 6.38 C34.74 5.91 38.94 4.72 40.46 4.71 C40.5 4.71 40.53 4.71 40.57 4.72 C40.57 4.72 40.57 4.72 40.57 4.72 C40.57 4.72 40.58 4.72 40.58 4.72 C40.61 4.71 40.65 4.71 40.68 4.71 C42.21 4.72 46.4 5.91 48.06 6.38 C53.35 7.86 58.46 10.02 63.34 12.5 L63.39 70.21 C63.19 73.17 62.14 76.6 60.25 78.91 C56.48 83.55 51.72 83.2 47.57 85.59 C46.53 86.19 44.21 88.82 43.09 89.78 C42.76 90.07 40.84 91.77 40.57 91.78 C40.31 91.77 38.39 90.07 38.05 89.78 C36.94 88.82 34.62 86.19 33.57 85.59 C29.43 83.2 24.67 83.55 20.89 78.91 C19.01 76.6 17.96 73.17 17.75 70.21 L17.8 12.5 M79.05 21.14 C78.86 20.12 70.18 13.66 68.82 12.79 C62.8 8.88 55.66 5.94 48.75 3.98 C47.06 3.5 42.36 2.14 40.58 2.1 L40.58 2.09 C40.58 2.09 40.57 2.1 40.57 2.1 C40.57 2.1 40.57 2.09 40.57 2.09 L40.57 2.1 C38.79 2.14 34.09 3.5 32.4 3.98 C25.48 5.94 18.35 8.88 12.32 12.79 C10.97 13.66 2.29 20.12 2.1 21.14 L2.08 73.42 C2.2 78.74 7.74 82.94 12.25 84.75 C14.17 85.53 17.12 85.83 18.71 86.65 C19.8 87.22 21.61 89.18 22.72 90.01 C27.2 93.36 34.57 98.97 39.5 101.2 C39.85 101.35 40.18 101.59 40.57 101.61 L40.57 101.61 C40.57 101.61 40.57 101.61 40.57 101.61 C40.57 101.61 40.58 101.61 40.58 101.61 L40.58 101.61 C40.96 101.59 41.3 101.35 41.65 101.2 C46.57 98.97 53.95 93.36 58.43 90.01 C59.54 89.18 61.35 87.22 62.44 86.65 C64.03 85.83 66.97 85.53 68.9 84.75 C73.41 82.94 78.94 78.74 79.07 73.42 L79.05 21.14" />
    </svg>
);

const FatorRDashboard = ({ clientData, isPrint = false }) => {
    const rbt12 = parseNumBR(clientData.rbt12);
    const revenue = parseNumBR(clientData.revenue) + parseNumBR(clientData.revenueRetained) + parseNumBR(clientData.revenueNonRetained);
    const folha12m = parseNumBR(clientData.folha12m !== undefined ? clientData.folha12m : clientData.folha);
    
    const fR = calcFatorR(folha12m, rbt12);
    const anexoEf = getAnexoEfetivo(clientData.anexo, fR, isSujeitoFatorR(clientData, folha12m));

    const rateIII = calcAliquotaEfetivaSN(rbt12, 'Anexo III').rate;
    const rateV = calcAliquotaEfetivaSN(rbt12, 'Anexo V').rate;
    
    const taxIII = revenue * (rateIII / 100);
    const taxV = revenue * (rateV / 100);
    const isFavorable = fR >= 28;
    const diff = Math.abs(taxV - taxIII);

    if (!isPrint) {
        return (
            <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-5 mt-2 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-navy flex items-center gap-2">
                        <Scale className="w-4 h-4" /> Análise Inteligente: Fator R
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isFavorable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {isFavorable ? 'Fator R Atingido (Anexo III)' : 'Fator R Não Atingido (Anexo V)'}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Folha + Pró-labore (12m)</p>
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(folha12m)}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Percentual Fator R</p>
                        <p className={`text-lg font-extrabold ${isFavorable ? 'text-emerald-600' : 'text-red-600'}`}>
                            {fR.toFixed(2).replace('.', ',')}%
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Alíquota Efetiva ({anexoEf})</p>
                        <p className="text-sm font-bold text-navy">
                            {(isFavorable ? rateIII : rateV).toFixed(2).replace('.', ',')}%
                        </p>
                    </div>
                </div>

                <div className="bg-slate-100/50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 mb-4 leading-relaxed">
                    <strong className="text-navy">Como funciona o Fator R?</strong> Para que sua atividade seja tributada no <strong>Anexo III</strong> (alíquotas menores), a soma da Folha de Pagamento + Pró-labore dos últimos 12 meses deve representar pelo menos <strong>28%</strong> do seu Faturamento (RBT12). Caso seja menor que 28%, a empresa é tributada no <strong>Anexo V</strong> (alíquotas maiores).
                </div>

                {revenue > 0 && (
                    <div className={`p-4 rounded-lg border ${isFavorable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} flex items-start gap-3`}>
                        {isFavorable ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
                        <div>
                            <p className={`text-xs font-bold mb-1 ${isFavorable ? 'text-emerald-800' : 'text-red-800'}`}>
                                {isFavorable ? 'Economia Tributária Gerada' : 'Custo Adicional por desenquadramento'}
                            </p>
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-[11px] text-slate-600 line-through">Anexo V: {formatCurrency(taxV)}</p>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <p className={`text-sm font-bold ${isFavorable ? 'text-emerald-700' : 'text-red-700'}`}>Anexo III: {formatCurrency(taxIII)}</p>
                            </div>
                            <p className={`text-lg font-black ${isFavorable ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isFavorable ? '-' : '+'} {formatCurrency(diff)} <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Neste mês</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="mb-5 avoid-break print-fator-r-box rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#1e3a8a]" />
                    <h3 className="text-[13px] font-bold text-[#1e3a8a] uppercase tracking-wide print-navy">Análise Fator R</h3>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isFavorable ? 'print-bg-emerald text-emerald-800' : 'print-bg-red text-red-800'}`}>
                    {isFavorable ? 'Atingido (Anexo III)' : 'Não Atingido (Anexo V)'}
                </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
                <div><p className="text-[9px] text-slate-500 font-bold uppercase">Folha + PL (12m)</p><p className="text-xs font-bold text-slate-800">{formatCurrency(folha12m)}</p></div>
                <div><p className="text-[9px] text-slate-500 font-bold uppercase">RBT12</p><p className="text-xs font-bold text-slate-800">{formatCurrency(rbt12)}</p></div>
                <div><p className="text-[9px] text-slate-500 font-bold uppercase">Percentual Atingido</p><p className={`text-sm font-extrabold ${isFavorable ? 'text-emerald-700' : 'text-red-700'}`}>{fR.toFixed(2).replace('.', ',')}%</p></div>
                <div><p className="text-[9px] text-slate-500 font-bold uppercase">Anexo Aplicado</p><p className="text-xs font-bold text-[#1e3a8a] print-navy">{anexoEf}</p></div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-[9px] text-slate-500 leading-relaxed text-justify">
                    <strong className="text-slate-700">Entenda o Fator R:</strong> Para ser tributada no Anexo III (alíquotas menores), a proporção da Folha de Pagamento + Pró-labore em relação ao Faturamento (RBT12) dos últimos 12 meses deve ser igual ou superior a 28%. Se for inferior, aplica-se o Anexo V (alíquotas maiores).
                </p>
            </div>

            {revenue > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="text-[10px]">
                            <span className="text-slate-500">Simulação Anexo V:</span> <span className="font-semibold text-slate-700">{formatCurrency(taxV)}</span>
                        </div>
                        <div className="text-[10px]">
                            <span className="text-slate-500">Simulação Anexo III:</span> <span className="font-semibold text-slate-700">{formatCurrency(taxIII)}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-bold uppercase text-slate-500">{isFavorable ? 'Economia Gerada no Mês' : 'Custo Extra no Mês'}</p>
                        <p className={`text-sm font-black ${isFavorable ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(diff)}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const Section = ({ title, icon: Icon, defaultOpen = true, children }) => {
    const [open, setOpen] = React.useState(defaultOpen);
    return (
        <div className="col-span-2 border border-slate-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-xs font-bold text-navy flex items-center gap-2">{Icon ? <Icon className="w-4 h-4" /> : null}{title}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? <div className="p-4">{children}</div> : null}
        </div>
    );
};

const EditorPanel = ({ clientData, setClientData, taxes, setTaxes, validationErrors = {}, setValidationErrors = () => { } }) => {

    const [forceShowRetentions, setForceShowRetentions] = useState(false);
    const [importMsg, setImportMsg] = useState(null);
    const pdfInputRef = React.useRef(null);

    const updateClient = (field, val) => setClientData(prev => ({ ...prev, [field]: val }));

    const handleImportPGDASD = async (file) => {
        if (!file) return;
        setImportMsg({ type: 'load', text: 'Lendo PDF…' });
        try {
            const text = await Promise.race([
                extractPdfText(file),
                new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado ao ler o arquivo (30s)')), 30000))
            ]);
            const d = parsePGDASD(text);
            if (!d.ok) { setImportMsg({ type: 'err', text: d.error || 'Não consegui ler como PGDAS-D.' }); return; }

            const rpaNum = pgNum(d.rpa), dasNum = pgNum(d.das);
            const rate = rpaNum > 0 && dasNum > 0 ? (dasNum / rpaNum * 100) : 0;
            const newData = {
                ...clientData,
                clientName: d.nome || clientData.clientName,
                cnpj: d.cnpj || clientData.cnpj,
                regime: 'Simples Nacional',
                atividade: d.atividade || clientData.atividade || 'Serviços',
                anexo: d.anexo || clientData.anexo,
                compMonth: d.compMonth || clientData.compMonth,
                compYear: d.compYear || clientData.compYear,
                competenceShort: d.competenceShort || clientData.competenceShort,
                competence: d.compMonth ? (MONTHS[parseInt(d.compMonth) - 1] + '/' + d.compYear) : clientData.competence,
                revenue: d.rpa || clientData.revenue,
                rbt12: d.rbt12 || clientData.rbt12,
                folha12m: d.folha12m || clientData.folha12m,
                municipio: d.municipio || clientData.municipio,
                evolucao: d.evolucao || clientData.evolucao || null,
            };
            delete newData.revenueRetained; delete newData.revenueNonRetained;
            const dueDate = getDueDate(d.compMonth, d.compYear, 'DAS');
            const dasTax = { id: Date.now(), tax: 'DAS', base: d.rpa || '', rate: rate ? rate.toFixed(2).replace('.', ',') : '', apurado: d.das || '', retido: '', value: d.das || '', dueDate, obs: `${d.anexo || 'Simples Nacional'} · Fator R ${d.fatorR || '—'}`, retidoManual: false };

            setClientData(newData);
            setTaxes(autoFillTaxes(newData, [dasTax]));
            setValidationErrors({});
            if (d.multiEstab) {
                setImportMsg({ type: 'err', text: `Importado: ${d.competenceShort || ''} · DAS ${formatCurrency(dasNum)} — PDF com mais de um estabelecimento, confira os valores` });
            } else {
                setImportMsg({ type: 'ok', text: `Importado: ${d.competenceShort || ''} · DAS ${formatCurrency(dasNum)}` });
                setTimeout(() => setImportMsg(m => (m && m.type === 'ok') ? null : m), 8000);
            }
        } catch (e) {
            console.error(e);
            setImportMsg({ type: 'err', text: 'Erro ao ler o PDF: ' + e.message });
        }
    };

    const recalcular = (overrideData) => {
        const data = overrideData || clientData;
        setTaxes(prev => {
            let baseTaxes = [...prev];
            if (baseTaxes.length === 0) {
                if (data.regime === 'Lucro Presumido' || data.regime === 'Lucro Real') {
                    baseTaxes = [...lpDefaults(data.atividade)];
                } else if (data.regime === 'Simples Nacional') {
                    baseTaxes = data.atividade === 'Comércio' ? [...DEFAULT_TAXES_SN_COMERCIO] : [...DEFAULT_TAXES_SN_SERVICOS];
                } else if (data.regime === 'MEI') {
                    const map = { 'Comércio': DEFAULT_TAXES_MEI_COMERCIO, 'Serviços': DEFAULT_TAXES_MEI_SERVICOS, 'Ambos': DEFAULT_TAXES_MEI_AMBOS };
                    baseTaxes = map[data.atividade || 'Serviços'] || [...DEFAULT_TAXES_MEI_SERVICOS];
                }
                baseTaxes = baseTaxes.map((t, i) => ({...t, id: Date.now() + i}));
            }

            // INSS do sócio entra/sai automaticamente conforme o pró-labore (exceto MEI, cujo INSS já está no DAS-MEI)
            const pl = sumProLabore(data);
            const idxINSS = baseTaxes.findIndex(t => t.tax === 'INSS (Sócio)');
            if (data.regime !== 'MEI' && pl > 0 && idxINSS === -1) {
                baseTaxes = [...baseTaxes, { id: Date.now() + Math.floor(Math.random() * 1000), tax: 'INSS (Sócio)', base: '', rate: '11,00', apurado: '', retido: '', value: '', dueDate: '', obs: 'Retenção de 11% sobre o pró-labore', retidoManual: false }];
            } else if ((pl <= 0 || data.regime === 'MEI') && idxINSS !== -1) {
                baseTaxes = baseTaxes.filter(t => t.tax !== 'INSS (Sócio)');
            }

            // IRRF do sócio entra/sai conforme o pró-labore (mesma lógica do INSS; MEI não tem)
            const idxIRRF = baseTaxes.findIndex(t => t.tax === 'IRRF');
            if (data.regime !== 'MEI' && pl > 0 && idxIRRF === -1) {
                baseTaxes = [...baseTaxes, { id: Date.now() + Math.floor(Math.random() * 1000) + 1, tax: 'IRRF', base: '', rate: '', apurado: '', retido: '', value: '', dueDate: '', obs: 'Pró-labore', retidoManual: false }];
            } else if ((pl <= 0 || data.regime === 'MEI') && idxIRRF !== -1) {
                baseTaxes = baseTaxes.filter(t => t.tax !== 'IRRF');
            }

            // FUMACOP (2%) entra/sai conforme a base; Antecipação Parcial e DIFAL ficam fixos no
            // template do comércio como valor manual.
            const isLPComercio = (data.regime === 'Lucro Presumido' || data.regime === 'Lucro Real') && (data.atividade === 'Comércio' || data.atividade === 'Indústria');
            const movC = isLPComercio ? calcComercioLP(data, calculateTotalRevenue(data)) : null;
            const temFumacop = !!(movC && movC.fumacop > 0);
            const idxFum = baseTaxes.findIndex(t => t.tax === 'FUMACOP');
            if (temFumacop && idxFum === -1) {
                baseTaxes = [...baseTaxes, { id: Date.now() + 101, tax: 'FUMACOP', base: '', rate: '2,00', apurado: '', retido: '', value: '', dueDate: '', obs: '', retidoManual: false }];
            } else if (!temFumacop && idxFum !== -1 && isLPComercio) {
                baseTaxes = baseTaxes.filter(t => t.tax !== 'FUMACOP');
            }

            // Anexo IV do Simples: a contribuição patronal (CPP 20%) NÃO está no DAS —
            // é recolhida à parte (GPS), sobre folha + pró-labore. Entra/sai com o anexo.
            const isAnexoIV = data.regime === 'Simples Nacional' && data.anexo === 'Anexo IV';
            const idxCPPiv = baseTaxes.findIndex(t => t.tax === 'CPP (Patronal)');
            if (isAnexoIV && idxCPPiv === -1) {
                baseTaxes = [...baseTaxes, { id: Date.now() + 202, tax: 'CPP (Patronal)', base: '', rate: '20,00', apurado: '', retido: '', value: '', dueDate: '', obs: 'Anexo IV — patronal fora do DAS (folha + pró-labore)', retidoManual: false }];
            } else if (!isAnexoIV && idxCPPiv !== -1 && data.regime === 'Simples Nacional') {
                baseTaxes = baseTaxes.filter(t => t.tax !== 'CPP (Patronal)');
            }

            // RAT (1–3%, ajustável por FAP) também é devido à parte no Anexo IV (art. 22, Lei 8.212/91),
            // sobre a folha. Simples segue dispensado de Terceiros (Sistema S).
            const idxRATiv = baseTaxes.findIndex(t => t.tax === 'RAT');
            if (isAnexoIV && idxRATiv === -1) {
                baseTaxes = [...baseTaxes, { id: Date.now() + 203, tax: 'RAT', base: '', rate: '1,00', apurado: '', retido: '', value: '', dueDate: '', obs: 'Anexo IV — RAT sobre a folha (ajuste pelo FAP)', retidoManual: false }];
            } else if (!isAnexoIV && idxRATiv !== -1 && data.regime === 'Simples Nacional') {
                baseTaxes = baseTaxes.filter(t => t.tax !== 'RAT');
            }

            return autoFillTaxes(data, baseTaxes);
        });
    };

    // Recalcula automaticamente quando um campo MUDA — mas NÃO ao montar/voltar de "Visualizar"
    // (senão ajustes manuais de centavos seriam refeitos toda vez que troca de aba).
    const jaMontou = React.useRef(false);
    React.useEffect(() => {
        if (!jaMontou.current) { jaMontou.current = true; return; }
        recalcular();
    }, [
        clientData.revenue,
        clientData.revenueRetained,
        clientData.revenueNonRetained,
        clientData.proLabore,
        clientData.socios,
        clientData.fap,
        clientData.folhaMensal,
        clientData.folha12m,
        clientData.rbt12,
        clientData.anexo,
        clientData.atividade,
        clientData.regime,
        clientData.equiparacaoHospitalar,
        clientData.receitaEquiparacao,
        clientData.irpjCsllMode,
        clientData.compMonth,
        clientData.compYear,
        clientData.periodRevenue,
        clientData.sujeitoFatorR,
        clientData.entradasCompras,
        clientData.aliqIcmsSaida,
        clientData.aliqIcmsEntrada,
        clientData.saldoCredorICMS,
        clientData.baseFumacop,
        clientData.saidasST,
        clientData.receitaMonofasica,
        clientData.icmsApurado,
        clientData.icmsDebitoTotal,
        clientData.icmsCreditoTotal,
        clientData.aliqInterestadual,
        clientData.baseDifal,
        clientData.baseAntecipacao,
        clientData.pisApurado,
        clientData.cofinsApurado
    ]);

    const updateTax = (id, field, val) => {
        setTaxes(prev => prev.map(t => {
            if (t.id !== id) return t;
            const updated = { ...t, [field]: val };
            
            if (field === 'base' || field === 'rate') {
                const b = parseNumBR(updated.base);
                const r = parseNumBR(updated.rate);
                if (b > 0 && r > 0) {
                    const ap = b * r / 100;
                    updated.apurado = formatBRLDisplay(ap);
                    updated.value = formatBRLDisplay(Math.max(0, ap - parseNumBR(updated.retido)));
                } else {
                    updated.apurado = ""; updated.value = "";
                }
            } else if (field === 'apurado' || field === 'retido') {
                if (field === 'retido') {
                    updated.retidoManual = (val.trim() !== '');
                }
                const a = parseNumBR(updated.apurado);
                const ret = parseNumBR(updated.retido);
                updated.value = formatBRLDisplay(Math.max(0, a - ret));
            }
            return updated;
        }));
    };

    const addTax = () => {
        setTaxes(prev => [...prev, { id: Date.now(), tax: "", base: "", rate: "", apurado: "", retido: "", value: "", dueDate: "", obs: "", retidoManual: false }]);
    };

    const removeTax = (id) => { setTaxes(prev => prev.filter(t => t.id !== id)); };

    const formatInputBRL = (raw) => {
        if (!raw && raw !== 0) return '';
        let digits = String(raw).replace(/\D/g, '');
        if (!digits) return '';
        let num = parseInt(digits, 10);
        return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const parseBRL = formatInputBRL;

    // ---- Sócios / pró-labore (cada um com INSS e IRRF individuais) ----
    const socios = (Array.isArray(clientData.socios) && clientData.socios.length)
        ? clientData.socios
        : [{ nome: '', valor: clientData.proLabore || '' }];
    const setSocios = (next) => setClientData(prev => {
        const total = next.reduce((s, x) => s + parseNumBR(x.valor), 0);
        return { ...prev, socios: next, proLabore: total > 0 ? formatBRLDisplay(total) : '' };
    });
    const updSocio = (i, field, val) => setSocios(socios.map((s, j) => j === i ? { ...s, [field]: val } : s));
    const addSocio = () => setSocios([...socios, { nome: '', valor: '' }]);
    const rmSocio = (i) => setSocios(socios.filter((_, j) => j !== i));

    const showFatorR = clientData.regime === 'Simples Nacional' && (clientData.anexo === 'Anexo V' || clientData.anexo === 'Anexo III') && parseNumBR(clientData.rbt12) > 0;
    const totalRevenue = calculateTotalRevenue(clientData);

    // Controle inteligente da tabela
    const hasRetentionsData = parseNumBR(clientData.revenueRetained) > 0 || taxes.some(t => parseNumBR(t.retido) > 0 || t.retidoManual);
    const showRetentionsTable = forceShowRetentions || hasRetentionsData;

    return (
        <div className="w-full">
            {clientData.regime === 'Simples Nacional' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2 animate-fade-in-up">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        <strong>Retenções no Simples Nacional:</strong> Para impostos retidos na fonte (como ISS ou INSS), basta clicar em "Habilitar Retenções" abaixo e inserir o valor direto na coluna "Retido" da tabela, o sistema abaterá automaticamente do "A Pagar".
                    </p>
                </div>
            )}
            {(clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (clientData.atividade || 'Serviços') === 'Serviços' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2 animate-fade-in-up">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="text-xs text-blue-800 font-medium leading-relaxed">
                        <p><strong>Automação de Retenções (IRPJ/CSLL/PIS/COFINS/ISS):</strong> Preencha o "Faturamento COM Retenção". O sistema aplica as retenções padrões e gera as colunas automaticamente.</p>
                        <p className="mt-1"><strong>Dica de Controle:</strong> Se suas notas tiverem alíquotas de retenção diferentes, digite o valor exato na coluna <strong>"Retido"</strong> da tabela. O sistema travará seu valor manual e não o sobrescreverá ao recalcular.</p>
                    </div>
                </div>
            )}
            {(clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (clientData.atividade === 'Comércio' || clientData.atividade === 'Indústria') && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2 animate-fade-in-up">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-800 font-medium leading-relaxed">
                        <strong>Comércio no {clientData.regime}:</strong> informe Entradas e Saídas abaixo — o sistema apura o ICMS por débito × crédito (com saldo credor), a Antecipação Parcial das compras interestaduais, o DIFAL e o FUMACOP (2%, Lei 8.205/04-MA). IRPJ e CSLL usam presunção de 8% / 12% automaticamente.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-md p-6 mb-6 animate-fade-in-up card-hover">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                        <Building2 className="w-5 h-5" /> Dados do Cliente
                    </h2>
                    <div className="flex items-center gap-2">
                        {importMsg && (
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${importMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : importMsg.type === 'err' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}>
                                {importMsg.type === 'ok' ? '✓ ' : importMsg.type === 'err' ? '✕ ' : ''}{importMsg.text}
                            </span>
                        )}
                        <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden"
                            onChange={e => { handleImportPGDASD(e.target.files[0]); e.target.value = ''; }} />
                        <button onClick={() => pdfInputRef.current && pdfInputRef.current.click()}
                            className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-900 transition-all cursor-pointer shadow-sm hover:shadow-md">
                            <FileText className="w-4 h-4" /> Importar PGDAS-D (PDF)
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="field-label">Nome / Razão Social <span className="text-red-400">*</span></label>
                        <input className={`field-input ${validationErrors.clientName ? 'field-error' : ''}`} value={clientData.clientName}
                            onChange={e => { updateClient('clientName', e.target.value); setValidationErrors(prev => ({ ...prev, clientName: undefined })); }}
                            placeholder="Ex: Empresa Exemplo LTDA" />
                        {validationErrors.clientName && <p className="field-error-msg">{validationErrors.clientName}</p>}
                    </div>
                    <div>
                        <label className="field-label">CNPJ</label>
                        <input className="field-input" value={clientData.cnpj} onChange={e => updateClient('cnpj', formatCNPJ(e.target.value))} placeholder="00.000.000/0001-00" />
                    </div>
                    <div>
                        <label className="field-label">Competência <span className="text-red-400">*</span></label>
                        <div className="flex gap-2">
                            <select className={`field-input flex-1 ${validationErrors.competence ? 'field-error' : ''}`} value={clientData.compMonth || (clientData.competenceShort ? String(parseInt(clientData.competenceShort.split('/')[0], 10)) : '')}
                                onChange={e => {
                                    const m = e.target.value; updateClient('compMonth', m);
                                    const y = clientData.compYear || new Date().getFullYear().toString();
                                    if (m) {
                                        updateClient('competence', MONTHS[parseInt(m) - 1] + '/' + y);
                                        updateClient('competenceShort', m.padStart(2, '0') + '/' + y);
                                        setValidationErrors(prev => ({ ...prev, competence: undefined }));
                                    }
                                }}>
                                <option value="">Mês</option>
                                {MONTHS.map((name, i) => <option key={i} value={String(i + 1)}>{name}</option>)}
                            </select>
                            <select className="field-input w-28" value={clientData.compYear || (clientData.competenceShort ? clientData.competenceShort.split('/')[1] : '')}
                                onChange={e => {
                                    const y = e.target.value; updateClient('compYear', y);
                                    const m = clientData.compMonth;
                                    if (m && y) {
                                        updateClient('competence', MONTHS[parseInt(m) - 1] + '/' + y);
                                        updateClient('competenceShort', m.padStart(2, '0') + '/' + y);
                                    }
                                }}>
                                <option value="">Ano</option>
                                {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={String(y)}>{y}</option>)}
                            </select>
                        </div>
                        {validationErrors.competence && <p className="field-error-msg">{validationErrors.competence}</p>}
                    </div>
                    <div>
                        <label className="field-label">Regime Tributário</label>
                        <select className="field-input" value={clientData.regime}
                            onChange={e => {
                                const nr = e.target.value;
                                const atv = clientData.atividade || 'Serviços';
                                
                                let updatedData = { ...clientData, regime: nr, atividade: atv };
                                let newTaxes = [];

                                if (nr === 'Lucro Presumido' || nr === 'Lucro Real') {
                                    newTaxes = [...lpDefaults(atv)];
                                    updatedData.anexo = '';
                                    updatedData.revenue = '';
                                    if ((atv === 'Comércio' || atv === 'Indústria') && !updatedData.aliqIcmsSaida) updatedData.aliqIcmsSaida = '23,00';
                                } else if (nr === 'Simples Nacional') {
                                    newTaxes = atv === 'Comércio' ? [...DEFAULT_TAXES_SN_COMERCIO] : [...DEFAULT_TAXES_SN_SERVICOS];
                                    updatedData.revenueRetained = '';
                                    updatedData.revenueNonRetained = '';
                                } else if (nr === 'MEI') {
                                    const map = { 'Comércio': DEFAULT_TAXES_MEI_COMERCIO, 'Serviços': DEFAULT_TAXES_MEI_SERVICOS, 'Ambos': DEFAULT_TAXES_MEI_AMBOS };
                                    newTaxes = map[atv] || [...DEFAULT_TAXES_MEI_SERVICOS];
                                    updatedData.anexo = '';
                                    updatedData.revenueRetained = '';
                                    updatedData.revenueNonRetained = '';
                                }

                                setClientData(updatedData);
                                setTaxes(autoFillTaxes(updatedData, newTaxes.map((t, i) => ({...t, id: Date.now() + i}))));
                            }}>
                            <option value="Lucro Presumido">Lucro Presumido</option>
                            <option value="Lucro Real">Lucro Real</option>
                            <option value="Simples Nacional">Simples Nacional</option>
                            <option value="MEI">MEI</option>
                        </select>
                    </div>
                    
                    {(clientData.regime === 'Simples Nacional' || clientData.regime === 'MEI' || clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (
                        <div>
                            <label className="field-label">Atividade</label>
                            <select className="field-input" value={clientData.atividade || 'Serviços'}
                                onChange={e => {
                                    const atv = e.target.value;
                                    if (clientData.regime === 'Simples Nacional') {
                                        updateClient('atividade', atv);
                                        const newTaxes = atv === 'Comércio' ? DEFAULT_TAXES_SN_COMERCIO : DEFAULT_TAXES_SN_SERVICOS;
                                        setTaxes(autoFillTaxes({ ...clientData, atividade: atv }, newTaxes));
                                    } else if (clientData.regime === 'MEI') {
                                        updateClient('atividade', atv);
                                        const map = { 'Comércio': DEFAULT_TAXES_MEI_COMERCIO, 'Serviços': DEFAULT_TAXES_MEI_SERVICOS, 'Ambos': DEFAULT_TAXES_MEI_AMBOS };
                                        setTaxes(map[atv] || DEFAULT_TAXES_MEI_SERVICOS);
                                    } else {
                                        // LP/Real: troca o conjunto padrão (ICMS no comércio, ISS nos serviços) e pré-preenche alíquotas
                                        const upd = { ...clientData, atividade: atv };
                                        if ((atv === 'Comércio' || atv === 'Indústria') && !upd.aliqIcmsSaida) upd.aliqIcmsSaida = '23,00';
                                        setClientData(upd);
                                        setTaxes(autoFillTaxes(upd, lpDefaults(atv).map((t, i) => ({ ...t, id: Date.now() + i }))));
                                    }
                                }}>
                                <option value="Serviços">Prestação de Serviços</option>
                                <option value="Comércio">Comércio</option>
                                <option value="Indústria">Indústria</option>
                                {clientData.regime === 'MEI' && <option value="Ambos">Comércio e Serviços</option>}
                            </select>
                        </div>
                    )}
                    
                    {clientData.regime === 'Simples Nacional' && (
                        <>
                            <div>
                                <label className="field-label">Anexo do Simples</label>
                                <select className="field-input" value={clientData.anexo || ''} onChange={e => updateClient('anexo', e.target.value)}>
                                    <option value="">Selecione o Anexo</option>
                                    <option value="Anexo I">Anexo I — Comércio</option>
                                    <option value="Anexo II">Anexo II — Indústria</option>
                                    <option value="Anexo III">Anexo III — Serviços (geral)</option>
                                    <option value="Anexo IV">Anexo IV — Serviços (c/ CPP à parte)</option>
                                    <option value="Anexo V">Anexo V — Serviços (fator R)</option>
                                </select>
                            </div>
                            <div>
                                <label className="field-label">Receita Bruta 12 meses — RBT12 (R$)</label>
                                <input className="field-input" type="text" value={clientData.rbt12 || ''}
                                    onChange={e => updateClient('rbt12', parseBRL(e.target.value))} placeholder="0,00" />
                            </div>
                            
                            {(clientData.anexo === 'Anexo V' || clientData.anexo === 'Anexo III') && (
                                <div>
                                    <label className="field-label">Folha + Pró-labore (12 meses) — p/ Fator R</label>
                                    <input className="field-input" type="text" value={clientData.folha12m !== undefined ? clientData.folha12m : (clientData.folha || '')}
                                        onChange={e => { updateClient('folha12m', parseBRL(e.target.value)); updateClient('folha', undefined); }} placeholder="0,00" />
                                </div>
                            )}

                            {(clientData.anexo === 'Anexo V' || clientData.anexo === 'Anexo III') && (
                                <label className="col-span-2 flex items-start gap-2 cursor-pointer select-none bg-white p-3 rounded-lg border border-blue-200">
                                    <input type="checkbox" className="w-4 h-4 mt-0.5 accent-blue-700"
                                        checked={isSujeitoFatorR(clientData, parseNumBR(clientData.folha12m !== undefined ? clientData.folha12m : clientData.folha))}
                                        onChange={e => updateClient('sujeitoFatorR', e.target.checked)} />
                                    <span className="text-xs font-bold text-navy leading-relaxed">Atividade sujeita ao Fator R
                                        <span className="font-medium text-slate-500"> — aplica a migração Anexo III ↔ V conforme a folha atinja ou não 28% do RBT12 (LC 123, §5º-I/J: fisioterapia, medicina, engenharia etc.). Desmarque para atividades que são Anexo III por natureza (ex.: contabilidade, escolas), que não migram para o Anexo V.</span>
                                    </span>
                                </label>
                            )}

                            {clientData.anexo === 'Anexo IV' && (
                                <div>
                                    <label className="field-label">Folha de Salários Mensal (R$)</label>
                                    <input className="field-input" type="text" value={clientData.folhaMensal !== undefined ? clientData.folhaMensal : (clientData.folha || '')}
                                        onChange={e => { updateClient('folhaMensal', parseBRL(e.target.value)); updateClient('folha', undefined); }} placeholder="0,00" />
                                </div>
                            )}
                            
                            <div>
                                <label className="field-label">Faturamento Bruto (R$) <span className="text-red-400">*</span></label>
                                <input className={`field-input ${validationErrors.revenue ? 'field-error' : ''}`} type="text" value={clientData.revenue || ''}
                                    onChange={e => { updateClient('revenue', parseBRL(e.target.value)); setValidationErrors(prev => ({ ...prev, revenue: undefined })); }}
                                    placeholder="0,00" />
                                {validationErrors.revenue && <p className="field-error-msg">{validationErrors.revenue}</p>}
                            </div>
                        </>
                    )}
                    
                    {(clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (
                        <div>
                            <label className="field-label">Folha de Salários Mensal (R$)</label>
                            <input className="field-input" type="text" value={clientData.folhaMensal !== undefined ? clientData.folhaMensal : (clientData.folha || '')}
                                onChange={e => { updateClient('folhaMensal', parseBRL(e.target.value)); updateClient('folha', undefined); }} placeholder="0,00" />
                        </div>
                    )}

                    {((clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') || (clientData.regime === 'Simples Nacional' && clientData.anexo === 'Anexo IV')) && (
                        <div>
                            <label className="field-label">FAP (multiplicador do RAT)</label>
                            <input className="field-input" type="text" inputMode="decimal" value={clientData.fap ?? ''}
                                onChange={e => updateClient('fap', e.target.value.replace(/[^\d,]/g, ''))} placeholder="1,0000 (deixe vazio = 1)" />
                        </div>
                    )}
                    
                    <div className="col-span-2">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="field-label !mb-0">Pró-labore dos sócios (R$)</label>
                            <button type="button" onClick={addSocio} className="text-[11px] font-bold text-navy hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar sócio</button>
                        </div>
                        <div className="space-y-2">
                            {socios.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input className="field-input flex-1" type="text" value={s.nome || ''} onChange={e => updSocio(i, 'nome', e.target.value)} placeholder={`Sócio ${i + 1} — nome (opcional)`} />
                                    <input className="field-input w-36" type="text" inputMode="decimal" value={s.valor || ''} onChange={e => updSocio(i, 'valor', parseBRL(e.target.value))} placeholder="0,00" />
                                    {socios.length > 1 && <button type="button" onClick={() => rmSocio(i)} aria-label="Remover sócio" className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>}
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">INSS 11% e IRRF calculados por sócio (teto e tabela progressiva individuais).</p>
                    </div>
                    
                    {(clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (clientData.atividade || 'Serviços') === 'Serviços' && (
                        <Section title="Faturamento & retenções" icon={DollarSign}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="field-label">Faturamento COM Retenção de Impostos (R$)</label>
                                    <input className="field-input border-emerald-200 focus:border-emerald-500" type="text" value={clientData.revenueRetained || ''}
                                        onChange={e => { updateClient('revenueRetained', parseBRL(e.target.value)); setValidationErrors(prev => ({ ...prev, revenue: undefined })); }}
                                        placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="field-label">Faturamento SEM Retenção de Impostos (R$)</label>
                                    <input className="field-input" type="text" value={clientData.revenueNonRetained || ''}
                                        onChange={e => { updateClient('revenueNonRetained', parseBRL(e.target.value)); setValidationErrors(prev => ({ ...prev, revenue: undefined })); }}
                                        placeholder="0,00" />
                                </div>
                            </div>
                            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase">Faturamento Bruto Total do Mês:</span>
                                <span className="text-lg font-extrabold text-navy">{formatCurrency(totalRevenue)}</span>
                            </div>
                            {parseNumBR(clientData.revenueRetained) > 0 && (() => {
                                const r = parseNumBR(clientData.revenueRetained);
                                const csrf = r * 0.0465, irpj = r * 0.015;
                                return (
                                    <div className="mt-3 bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
                                        <p className="text-xs font-bold text-emerald-800 mb-1.5">Retenções estimadas sobre {formatCurrency(r)}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
                                            <span>PIS/COFINS/CSLL (4,65%): <b className="text-slate-800">{formatCurrency(csrf)}</b></span>
                                            <span>IRPJ (1,5%): <b className="text-slate-800">{formatCurrency(irpj)}</b></span>
                                            <span className="text-emerald-700 font-bold">Total federal: {formatCurrency(csrf + irpj)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1.5">+ ISS conforme o município (alíquota da linha ISS). A CSRF (4,65%) só incide em notas acima de R$ 5.000/mês por tomador — se não se aplicar, ajuste na coluna "Retido" da tabela.</p>
                                    </div>
                                );
                            })()}
                            {validationErrors.revenue && <p className="field-error-msg mt-1 text-center">{validationErrors.revenue}</p>}
                        </Section>
                    )}

                    {(clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (clientData.atividade === 'Comércio' || clientData.atividade === 'Indústria') && (
                        <Section title="ICMS — comércio (entradas × saídas, ST, SPED, interestadual)" icon={DollarSign}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="field-label">Total de Saídas — Vendas (R$) <span className="text-red-400">*</span></label>
                                    <input className={`field-input border-amber-200 focus:border-amber-500 ${validationErrors.revenue ? 'field-error' : ''}`} type="text" value={clientData.revenueNonRetained || ''}
                                        onChange={e => { updateClient('revenueNonRetained', parseBRL(e.target.value)); setValidationErrors(prev => ({ ...prev, revenue: undefined })); }}
                                        placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="field-label">Entradas — Mercadorias recebidas (crédito de ICMS) (R$)</label>
                                    <input className="field-input" type="text" value={clientData.entradasCompras || ''}
                                        onChange={e => updateClient('entradasCompras', parseBRL(e.target.value))} placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="field-label">Alíq. interna ICMS (%) — MA: 23%</label>
                                    <input className="field-input" type="text" value={clientData.aliqIcmsSaida || ''}
                                        onChange={e => updateClient('aliqIcmsSaida', e.target.value.replace(/\./g, ',').replace(/[^\d,]/g, ''))} placeholder="23,00" />
                                </div>
                                <div>
                                    <label className="field-label">Alíq. média do crédito de entradas (%)</label>
                                    <input className="field-input" type="text" value={clientData.aliqIcmsEntrada || ''}
                                        onChange={e => updateClient('aliqIcmsEntrada', e.target.value.replace(/\./g, ',').replace(/[^\d,]/g, ''))} placeholder="= alíq. interna" />
                                </div>
                                <div>
                                    <label className="field-label">ICMS débito TOTAL (R$) — ajustes em bloco</label>
                                    <input className="field-input border-blue-200 focus:border-blue-500" type="text" value={clientData.icmsDebitoTotal || ''}
                                        onChange={e => updateClient('icmsDebitoTotal', parseBRL(e.target.value))} placeholder="prevalece sobre saídas × alíq." />
                                </div>
                                <div>
                                    <label className="field-label">ICMS crédito TOTAL (R$) — ajustes em bloco</label>
                                    <input className="field-input border-blue-200 focus:border-blue-500" type="text" value={clientData.icmsCreditoTotal || ''}
                                        onChange={e => updateClient('icmsCreditoTotal', parseBRL(e.target.value))} placeholder="prevalece sobre entradas × alíq." />
                                </div>
                                <div>
                                    <label className="field-label">Saldo credor ICMS do mês anterior (R$)</label>
                                    <input className="field-input" type="text" value={clientData.saldoCredorICMS || ''}
                                        onChange={e => updateClient('saldoCredorICMS', parseBRL(e.target.value))} placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="field-label">Vendas c/ FUMACOP — Lei 8.205/04 (R$)</label>
                                    <input className="field-input" type="text" value={clientData.baseFumacop || ''}
                                        onChange={e => updateClient('baseFumacop', parseBRL(e.target.value))} placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="field-label">Saídas em ST — não geram débito (R$)</label>
                                    <input className="field-input" type="text" value={clientData.saidasST || ''}
                                        onChange={e => updateClient('saidasST', parseBRL(e.target.value))} placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="field-label">Revenda monofásica/ST — PIS/COFINS zero (R$)</label>
                                    <input className="field-input" type="text" value={clientData.receitaMonofasica || ''}
                                        onChange={e => updateClient('receitaMonofasica', parseBRL(e.target.value))} placeholder="0,00" />
                                </div>
                                <div className="col-span-2">
                                    <label className="field-label">ICMS apurado no SPED/EFD (R$) — se preenchido, prevalece sobre a estimativa</label>
                                    <input className="field-input border-amber-200 focus:border-amber-500" type="text" value={clientData.icmsApurado || ''}
                                        onChange={e => updateClient('icmsApurado', parseBRL(e.target.value))} placeholder="Saldo devedor de ICMS apurado na escrituração fiscal" />
                                </div>
                                <div className="col-span-2 border-t border-slate-100 pt-3 mt-1">
                                    <p className="text-[11px] font-bold text-navy mb-2">ICMS interestadual — DIFAL / Antecipação (compras de outros estados)</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="field-label">Alíq. interestadual (%)</label>
                                            <input className="field-input" type="text" value={clientData.aliqInterestadual || ''} onChange={e => updateClient('aliqInterestadual', e.target.value.replace(/\./g, ',').replace(/[^\d,]/g, ''))} placeholder="12 (ou 7 / 4)" />
                                        </div>
                                        <div>
                                            <label className="field-label">Base Antecipação — p/ revenda (R$)</label>
                                            <input className="field-input" type="text" value={clientData.baseAntecipacao || ''} onChange={e => updateClient('baseAntecipacao', parseBRL(e.target.value))} placeholder="0,00" />
                                        </div>
                                        <div>
                                            <label className="field-label">Base DIFAL — uso/consumo/ativo (R$)</label>
                                            <input className="field-input" type="text" value={clientData.baseDifal || ''} onChange={e => updateClient('baseDifal', parseBRL(e.target.value))} placeholder="0,00" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5">Calculado como base × (alíquota interna − interestadual). As linhas <b>DIFAL</b> e <b>Antecipação Parcial</b> na tabela são preenchidas automaticamente.</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Três formas de fechar o ICMS próprio, da mais simples à mais precisa: <b>(1)</b> saídas × alíquota (estimativa); <b>(2)</b> lance os <b>totais de débito e crédito</b> do livro de apuração (ajustes em bloco); <b>(3)</b> cole o <b>ICMS apurado no SPED</b> (definitivo, prevalece sobre tudo).</p>
                            {(() => {
                                const mov = calcComercioLP(clientData, totalRevenue);
                                const sped = parseNumBR(clientData.icmsApurado);
                                const temCredor = !sped && mov.icms && mov.icms.saldoCredor > 0;
                                return (
                                    <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase">ICMS Débito − Crédito (estim.)</p>
                                            <p className="text-sm font-bold text-slate-700">{mov.icms ? `${formatCurrency(mov.icms.debito)} − ${formatCurrency(mov.icms.credito)}` : '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase">{sped > 0 ? 'ICMS (SPED)' : (temCredor ? 'Saldo credor' : 'ICMS a recolher')}</p>
                                            <p className={`text-sm font-extrabold ${temCredor ? 'text-emerald-600' : 'text-navy'}`}>{sped > 0 ? formatCurrency(sped) : (mov.icms ? formatCurrency(mov.icms.saldoCredor > 0 ? mov.icms.saldoCredor : mov.icms.aPagar) : '—')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase">FUMACOP (2%)</p>
                                            <p className="text-sm font-bold text-slate-700">{mov.fumacop > 0 ? formatCurrency(mov.fumacop) : '—'}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                            {parseNumBR(clientData.receitaMonofasica) > 0 && (() => {
                                const mono = Math.min(parseNumBR(clientData.receitaMonofasica), totalRevenue);
                                const basePC = Math.max(0, totalRevenue - mono);
                                return (
                                    <div className="mt-3 bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 text-[11px] text-slate-600">
                                        <p className="font-bold text-emerald-800 mb-1">PIS/COFINS sobre base de {formatCurrency(basePC)} (sem monofásico/ST)</p>
                                        <div className="flex flex-wrap gap-3">
                                            <span>Monofásico/ST excluído: <b>{formatCurrency(mono)}</b></span>
                                            <span>PIS (0,65%): <b>{formatCurrency(basePC * 0.0065)}</b></span>
                                            <span>COFINS (3%): <b>{formatCurrency(basePC * 0.03)}</b></span>
                                        </div>
                                    </div>
                                );
                            })()}
                            {validationErrors.revenue && <p className="field-error-msg mt-1 text-center">{validationErrors.revenue}</p>}
                        </Section>
                    )}

                    {clientData.regime === 'Lucro Real' && (
                        <Section title="PIS / COFINS — Lucro Real (não-cumulativo)" icon={BadgePercent}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="field-label">PIS apurado (R$) — líquido de créditos</label>
                                    <input className="field-input" type="text" value={clientData.pisApurado || ''} onChange={e => updateClient('pisApurado', parseBRL(e.target.value))} placeholder="débito 1,65% − créditos" />
                                </div>
                                <div>
                                    <label className="field-label">COFINS apurado (R$) — líquido de créditos</label>
                                    <input className="field-input" type="text" value={clientData.cofinsApurado || ''} onChange={e => updateClient('cofinsApurado', parseBRL(e.target.value))} placeholder="débito 7,6% − créditos" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5">No Lucro Real, PIS/COFINS é não-cumulativo (1,65% / 7,6%) com créditos. Informe o valor apurado — prevalece sobre as linhas PIS e COFINS.</p>
                        </Section>
                    )}

                    {(clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (
                        <Section title="IRPJ / CSLL & equiparação" icon={Landmark}>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <label className="field-label">Forma de Apuração</label>
                                    <select className="field-input border-blue-200 focus:border-blue-500" value={clientData.irpjCsllMode || 'Mensal (Provisão)'}
                                        onChange={e => updateClient('irpjCsllMode', e.target.value)}>
                                        <option value="Mensal (Provisão)">Provisão Mensal (Calculada no mês)</option>
                                        <option value="Trimestral (Apuração)">Apuração Trimestral (Definitiva)</option>
                                        {clientData.regime === 'Lucro Real' && <option value="Estimativa (Anual)">Estimativa Mensal (Anual)</option>}
                                    </select>
                                </div>
                                
                                {(clientData.irpjCsllMode === 'Trimestral (Apuração)' || clientData.irpjCsllMode === 'Estimativa (Anual)') && (
                                    <div className="animate-fade-in">
                                        <label className="field-label">Faturamento Acumulado no Período (R$)</label>
                                        <input className="field-input border-amber-200 focus:border-amber-500 bg-white" type="text" value={clientData.periodRevenue || ''}
                                            onChange={e => updateClient('periodRevenue', parseBRL(e.target.value))}
                                            placeholder="Acumulado do trimestre/ano" />
                                        <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">Base para calcular IRPJ/CSLL</p>
                                    </div>
                                )}
                                
                                {clientData.irpjCsllMode === 'Mensal (Provisão)' && (
                                    <div className="flex items-center">
                                        <p className="text-[10px] text-slate-500 italic">IRPJ e CSLL serão calculados com base no Faturamento Bruto Total do Mês demonstrado acima.</p>
                                    </div>
                                )}
                                {(clientData.atividade || 'Serviços') === 'Serviços' && (
                                    <label className="col-span-2 flex items-start gap-2 mt-1 cursor-pointer select-none bg-white p-3 rounded-lg border border-emerald-200">
                                        <input type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-600" checked={!!clientData.equiparacaoHospitalar}
                                            onChange={e => {
                                                updateClient('equiparacaoHospitalar', e.target.checked);
                                                // Clínicas costumam ter 100% da receita equiparada — pré-preenche se vazio
                                                if (e.target.checked && !parseNumBR(clientData.receitaEquiparacao) && totalRevenue > 0) updateClient('receitaEquiparacao', formatBRLDisplay(totalRevenue));
                                            }} />
                                        <span className="text-xs font-bold text-navy leading-relaxed">Equiparação hospitalar
                                            <span className="font-medium text-slate-500"> — aplica presunção reduzida (IRPJ 8% · CSLL 12%) na parte da receita que se enquadra. Use para serviços de saúde que atendam aos requisitos legais (Lei 9.249/95).</span>
                                        </span>
                                    </label>
                                )}
                                {(clientData.atividade || 'Serviços') === 'Serviços' && clientData.equiparacaoHospitalar && (
                                    <div className="col-span-2 animate-fade-in">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="field-label !mb-0">Receita COM equiparação hospitalar (R$) — presunção 8% / 12%</label>
                                            <button type="button" onClick={() => updateClient('receitaEquiparacao', formatBRLDisplay(totalRevenue))} className="text-[11px] font-bold text-emerald-700 hover:underline">Usar todo o faturamento</button>
                                        </div>
                                        <input className="field-input border-emerald-200 focus:border-emerald-500" type="text" value={clientData.receitaEquiparacao || ''}
                                            onChange={e => updateClient('receitaEquiparacao', parseBRL(e.target.value))} placeholder="0,00" />
                                        {(() => {
                                            const eq = Math.min(parseNumBR(clientData.receitaEquiparacao), totalRevenue);
                                            const pct = totalRevenue > 0 ? (eq / totalRevenue) * 100 : 0;
                                            return <p className="text-[10px] text-slate-500 mt-1">{eq > 0
                                                ? `${pct.toFixed(0)}% da receita na presunção reduzida (8%/12%) · ${formatCurrency(Math.max(0, totalRevenue - eq))} segue a 32%.`
                                                : 'Informe a parcela equiparada — ou clique em "Usar todo o faturamento" se a clínica se enquadra 100%.'}</p>;
                                        })()}
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {showFatorR && (<Section title="Análise Fator R" icon={Scale} defaultOpen={false}><div className="col-span-2"><FatorRDashboard clientData={clientData} isPrint={false} /></div></Section>)}

                    {showFatorR && (
                        <label className="col-span-2 flex items-start gap-2 cursor-pointer select-none bg-white p-3 rounded-lg border border-emerald-200">
                            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-600" checked={!!clientData.mostrarEconomiaFatorR}
                                onChange={e => updateClient('mostrarEconomiaFatorR', e.target.checked)} />
                            <span className="text-xs font-bold text-navy leading-relaxed">Mostrar economia do Fator R no relatório
                                <span className="font-medium text-slate-500"> — exibe o comparativo Anexo III × Anexo V como "economia gerada". Marque só quando a atividade realmente depende do Fator R, e não para atividades que já são Anexo III por natureza (ex.: certos serviços de saúde).</span>
                            </span>
                        </label>
                    )}

                    {parseNumBR(clientData.rbt12) > 0 && clientData.anexo && !showFatorR && clientData.regime === 'Simples Nacional' && (
                        (() => {
                            const rbt12 = parseNumBR(clientData.rbt12);
                            const folha12m = parseNumBR(clientData.folha12m !== undefined ? clientData.folha12m : clientData.folha);
                            const fR = calcFatorR(folha12m, rbt12);
                            const anexoEf = getAnexoEfetivo(clientData.anexo, fR, isSujeitoFatorR(clientData, folha12m));
                            const res = calcAliquotaEfetivaSN(rbt12, anexoEf);
                            return (
                                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2">
                                    <p className="text-xs font-bold text-navy mb-2 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> Alíquota Efetiva Calculada
                                    </p>
                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Anexo Efetivo</p>
                                            <p className="text-sm font-bold text-navy">{anexoEf}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Faixa</p>
                                            <p className="text-sm font-bold text-navy">{res.faixa}ª</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Alíq. Nominal</p>
                                            <p className="text-sm font-bold text-slate-700">{res.nominal.toFixed(2).replace('.', ',')}%</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Alíq. Efetiva</p>
                                            <p className="text-lg font-extrabold text-emerald-700">{res.rate.toFixed(2).replace('.', ',')}%</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 text-center">Dedução da faixa: {formatCurrency(res.deduction)} • RBT12: {formatCurrency(rbt12)}</p>
                                </div>
                            );
                        })()
                    )}

                    {(() => {
                        const compM = parseInt(clientData.compMonth || (clientData.competenceShort ? clientData.competenceShort.split('/')[0] : ''), 10);
                        const compY = parseInt(clientData.compYear || (clientData.competenceShort ? clientData.competenceShort.split('/')[1] : ''), 10);
                        const hasComp = compM >= 1 && compM <= 12 && compY > 1900;
                        const ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        const exist = {}; (Array.isArray(clientData.evolucao) ? clientData.evolucao : []).forEach(e => exist[e.ym] = parseNumBR(e.receita));
                        const win = [];
                        if (hasComp) { for (let k = 11; k >= 0; k--) { let mm = compM - k, yy = compY; while (mm <= 0) { mm += 12; yy--; } const key = String(mm).padStart(2, '0') + '/' + yy; win.push({ ym: key, mm, yy, receita: exist[key] || 0 }); } }
                        const soma = win.reduce((s, e) => s + e.receita, 0);
                        const setEv = (ym, raw) => { const val = parseNumBR(formatInputBRL(raw)); updateClient('evolucao', win.map(e => ({ ym: e.ym, receita: e.ym === ym ? val : e.receita }))); };
                        return (
                            <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                    <p className="text-xs font-bold text-navy flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Faturamento dos últimos 12 meses</p>
                                    {hasComp && (
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-slate-500">Soma (RBT12): <strong className="text-navy">{formatCurrency(soma)}</strong></span>
                                            <button onClick={() => updateClient('rbt12', formatBRLDisplay(soma))} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200 font-bold cursor-pointer hover:bg-emerald-100">usar como RBT12</button>
                                        </div>
                                    )}
                                </div>
                                {!hasComp ? (
                                    <p className="text-[11px] text-slate-500 italic">Selecione a Competência (mês/ano) acima para liberar os 12 meses.</p>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2">
                                        {win.map((e) => (
                                            <div key={e.ym}>
                                                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">{ABBR[e.mm - 1]}/{String(e.yy).slice(2)}</label>
                                                <input className="field-input !py-1.5 !px-2 !text-xs text-right" type="text" value={e.receita > 0 ? formatBRLDisplay(e.receita) : ''} onChange={ev => setEv(e.ym, ev.target.value)} placeholder="0,00" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-[9px] text-slate-400 mt-2">Alimenta o gráfico de evolução do relatório. É preenchido automaticamente ao importar o PGDAS-D; aqui você pode digitar/editar manualmente.</p>
                            </div>
                        );
                    })()}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h2 className="text-lg font-bold text-navy mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Informações Adicionais
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="field-label">Telefone do Escritório</label>
                        <input className="field-input" value={clientData.officePhone || ''}
                            onChange={e => updateClient('officePhone', e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                        <label className="field-label">E-mail do Escritório</label>
                        <input className="field-input" value={clientData.officeEmail || ''}
                            onChange={e => updateClient('officeEmail', e.target.value)} placeholder="contato@escritorio.com" />
                    </div>
                </div>
                <div>
                    <label className="field-label">Observações Gerais</label>
                    <textarea className="field-input min-h-[80px] resize-y" value={clientData.observations || ''}
                        onChange={e => updateClient('observations', e.target.value)} placeholder="Notas adicionais para o cliente..." />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        Tributos Apurados
                    </h2>
                    <div className="flex gap-2">
                        {!showRetentionsTable && (
                            <button onClick={() => setForceShowRetentions(true)} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer">
                                + Habilitar Retenções
                            </button>
                        )}
                        <button onClick={() => { recalcular(); }}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all cursor-pointer shadow-sm hover:shadow-md">
                            <TrendingUp className="w-4 h-4" /> Recalcular Tudo
                        </button>
                        <button onClick={addTax}
                            className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-900 transition-all cursor-pointer shadow-sm hover:shadow-md">
                            <Plus className="w-4 h-4" /> Adicionar Tributo
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2 border-slate-200">
                                <th className="text-left py-2 px-1 text-[10px] uppercase text-slate-500 font-bold min-w-[100px]">Tributo</th>
                                <th className="text-left py-2 px-1 text-[10px] uppercase text-slate-500 font-bold w-24">Base</th>
                                <th className="text-center py-2 px-1 text-[10px] uppercase text-slate-500 font-bold w-16">Alíq(%)</th>
                                
                                {showRetentionsTable && (
                                    <>
                                        <th className="text-left py-2 px-1 text-[10px] uppercase text-slate-500 font-bold w-24">Apurado</th>
                                        <th className="text-left py-2 px-1 text-[10px] uppercase text-emerald-600 font-bold w-24" title="Você pode editar os valores de retenção.">Retido ✎</th>
                                    </>
                                )}
                                
                                <th className="text-left py-2 px-1 text-[10px] uppercase text-navy font-extrabold w-24">{showRetentionsTable ? 'A Pagar' : 'Valor (R$)'}</th>
                                <th className="text-center py-2 px-1 text-[10px] uppercase text-slate-500 font-bold w-24">Venc.</th>
                                <th className="text-left py-2 px-1 text-[10px] uppercase text-slate-500 font-bold min-w-[120px]">Obs</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxes.map((row) => (
                                <tr key={row.id} className="border-b border-slate-100 tax-row group">
                                    <td className="py-2 px-1"><input className="field-input !py-1.5 !px-2 !text-xs font-bold text-navy" value={row.tax} onChange={e => updateTax(row.id, 'tax', e.target.value)} placeholder="Nome" /></td>
                                    <td className="py-2 px-1"><input className="field-input !py-1.5 !px-2 !text-xs text-right" value={row.base} onChange={e => updateTax(row.id, 'base', formatInputBRL(e.target.value))} placeholder="0,00" /></td>
                                    <td className="py-2 px-1"><input className="field-input !py-1.5 !px-2 !text-xs text-center bg-slate-50" value={row.rate} onChange={e => updateTax(row.id, 'rate', e.target.value.replace(/\./g, ',').replace(/[^\d,]/g, ''))} placeholder="0,00" /></td>
                                    
                                    {showRetentionsTable && (
                                        <>
                                            <td className="py-2 px-1"><input className="field-input !py-1.5 !px-2 !text-xs text-right font-medium" value={row.apurado} onChange={e => updateTax(row.id, 'apurado', formatInputBRL(e.target.value))} placeholder="0,00" /></td>
                                            <td className="py-2 px-1">
                                                <input 
                                                    className={`field-input !py-1.5 !px-2 !text-xs text-right text-emerald-700 bg-emerald-50 border-emerald-200 focus:border-emerald-500 ${row.retidoManual ? 'shadow-[inset_0_0_0_1px_rgba(52,211,153,0.3)]' : ''}`} 
                                                    value={row.retido} 
                                                    onChange={e => updateTax(row.id, 'retido', formatInputBRL(e.target.value))} 
                                                    placeholder="0,00" 
                                                    title={row.retidoManual ? "Valor editado manualmente (Travado)" : "Valor calculado automaticamente"}
                                                />
                                            </td>
                                        </>
                                    )}

                                    <td className="py-2 px-1"><input className={`field-input !py-1.5 !px-2 !text-xs text-right font-bold text-navy ${showRetentionsTable ? 'bg-blue-50 border-blue-200' : ''}`} value={row.value} onChange={e => updateTax(row.id, 'value', formatInputBRL(e.target.value))} placeholder="0,00" /></td>
                                    <td className="py-2 px-1"><input className="field-input !py-1.5 !px-2 !text-xs text-center" value={row.dueDate} onChange={e => { const dg = e.target.value.replace(/\D/g, '').slice(0, 8); const fmt = dg.length > 4 ? dg.slice(0, 2) + '/' + dg.slice(2, 4) + '/' + dg.slice(4) : dg.length > 2 ? dg.slice(0, 2) + '/' + dg.slice(2) : dg; updateTax(row.id, 'dueDate', fmt); }} placeholder="dd/mm/aaaa" /></td>
                                    <td className="py-2 px-1"><input className="field-input !py-1.5 !px-2 !text-[11px]" value={row.obs} onChange={e => updateTax(row.id, 'obs', e.target.value)} placeholder="Observação" /></td>
                                    <td className="py-2 px-1 text-center"><button onClick={() => removeTax(row.id)} aria-label={'Remover ' + (row.tax || 'tributo')} className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Trash2 className="w-4 h-4" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {taxes.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum tributo adicionado. Clique em "Recalcular Tudo" para restaurar os padrões.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

                const ReportPreview = ({ clientData, taxes }) => {
    const parseNum = parseNumBR;

    const revenue = calculateTotalRevenue(clientData);
    // Linhas "(retido)" são informativas (valor já retido na fonte) — não entram como guia a pagar
    const ehRetido = (t) => /\(retido\)/i.test(t.tax || '');
    const totalTributos = taxes.reduce((s, r) => s + (ehRetido(r) ? 0 : parseNum(r.value)), 0);
    const totalApurado = taxes.reduce((s, r) => s + (ehRetido(r) ? 0 : (parseNum(r.apurado) || parseNum(r.value))), 0);
    const totalRetido = taxes.reduce((s, r) => s + parseNum(r.retido), 0);
    const aliquotaEfetiva = revenue > 0 ? (totalApurado / revenue) * 100 : 0;

    const rbt12 = parseNum(clientData.rbt12);
    const folha12m = parseNum(clientData.folha12m !== undefined ? clientData.folha12m : clientData.folha);
    const fR = calcFatorR(folha12m, rbt12);
    const anexoEfetivo = clientData.regime === 'Simples Nacional' && clientData.anexo ? getAnexoEfetivo(clientData.anexo, fR, isSujeitoFatorR(clientData, folha12m)) : clientData.anexo;

    const hasRetentions = parseNum(clientData.revenueRetained) > 0 || taxes.some(t => parseNum(t.retido) > 0 || t.retidoManual);
    const isSN = clientData.regime === 'Simples Nacional' || clientData.regime === 'MEI';
    const liquido = revenue - totalApurado;
    const compLabel = clientData.competence || clientData.competenceShort || '—';

    // Função que totaliza uma lista de tributos
    const calcTotal = (list) => list.reduce((s, t) => s + parseNum(t.value), 0);

    // ===== Economia inteligente: Fator R (Simples) e Equiparação Hospitalar (Lucro Presumido) =====
    let economia = null;
    if (clientData.mostrarEconomiaFatorR && clientData.regime === 'Simples Nacional' && (clientData.anexo === 'Anexo III' || clientData.anexo === 'Anexo V') && rbt12 > 0 && fR >= 28) {
        const rateIII = calcAliquotaEfetivaSN(rbt12, 'Anexo III').rate;
        const rateV = calcAliquotaEfetivaSN(rbt12, 'Anexo V').rate;
        const taxIII = revenue * rateIII / 100;
        const taxV = revenue * rateV / 100;
        if (taxV - taxIII > 0) {
            economia = {
                tipo: 'Fator R',
                valor: taxV - taxIII,
                semLabel: 'Sem Fator R · Anexo V',
                comLabel: 'Com Fator R · Anexo III',
                semVal: taxV, comVal: taxIII,
                semExtra: `Alíquota efetiva ${rateV.toFixed(2).replace('.', ',')}%`,
                comExtra: `Alíquota efetiva ${rateIII.toFixed(2).replace('.', ',')}%`,
                explica: `A folha + pró-labore dos últimos 12 meses representa ${fR.toFixed(1).replace('.', ',')}% do RBT12 (≥ 28%), enquadrando a empresa no Anexo III — alíquotas menores. Sem atingir o Fator R, a tributação seria pelo Anexo V.`,
            };
        }
    } else if ((clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && clientData.equiparacaoHospitalar && (clientData.atividade || 'Serviços') === 'Serviços') {
        const periodMode = clientData.irpjCsllMode === 'Trimestral (Apuração)' || clientData.irpjCsllMode === 'Estimativa (Anual)';
        const baseRev = periodMode && parseNum(clientData.periodRevenue) > 0 ? parseNum(clientData.periodRevenue) : revenue;
        const eqRev = Math.min(Math.max(parseNum(clientData.receitaEquiparacao), 0), baseRev);
        const normRev = baseRev - eqRev;
        const adicLimit = clientData.irpjCsllMode === 'Trimestral (Apuração)' ? 60000 : 20000;
        const baseIrpjSem = baseRev * 0.32, baseCsllSem = baseRev * 0.32;
        const semVal = (baseIrpjSem * 0.15) + (baseCsllSem * 0.09) + (Math.max(0, baseIrpjSem - adicLimit) * 0.10);
        const baseIrpjCom = eqRev * 0.08 + normRev * 0.32, baseCsllCom = eqRev * 0.12 + normRev * 0.32;
        const comVal = (baseIrpjCom * 0.15) + (baseCsllCom * 0.09) + (Math.max(0, baseIrpjCom - adicLimit) * 0.10);
        if (eqRev > 0 && semVal - comVal > 0) {
            economia = {
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

    // Faturamento
    const isLPComercioRep = (clientData.regime === 'Lucro Presumido' || clientData.regime === 'Lucro Real') && (clientData.atividade === 'Comércio' || clientData.atividade === 'Indústria');
    const fatRows = isSN
        ? [{ label: 'Receita bruta do mês', val: revenue }]
        : isLPComercioRep
            ? [{ label: 'Receita de vendas (saídas)', val: revenue }]
            : [
                { label: 'Receita com retenção', val: parseNum(clientData.revenueRetained) },
                { label: 'Receita sem retenção', val: parseNum(clientData.revenueNonRetained) },
            ];

    // Impostos
    let taxRows = taxes.filter(t => t.tax && !ehRetido(t) && parseNum(t.value) > 0);
    if (taxRows.length === 0) taxRows = taxes.filter(t => t.tax && !ehRetido(t));

    // Vencimentos — uma guia por linha (detalhado, sem agrupar)
    const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    // Só datas dd/mm/aaaa válidas entram no calendário (texto livre mal formatado não vai pro PDF)
    const validDue = (s) => { if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false; const d = +s.slice(0, 2), m = +s.slice(3, 5); return d >= 1 && d <= 31 && m >= 1 && m <= 12; };
    const withDue = taxes.filter(t => t.tax && !ehRetido(t) && t.dueDate && validDue(t.dueDate) && parseNum(t.value) > 0)
        .sort((a, b) => {
            const pa = a.dueDate.split('/'), pb = b.dueDate.split('/');
            return new Date(pa[2], pa[1] - 1, pa[0]) - new Date(pb[2], pb[1] - 1, pb[0]);
        });
    const totalDue = calcTotal(withDue);
    // Agrupamento por mês — o 1º mês fica na página Vencimentos; meses extras viram páginas próprias
    const venciByMonth = {};
    withDue.forEach(t => {
        const pp = t.dueDate.split('/'); const d = +pp[0], m = +pp[1], y = +pp[2];
        const k = y + '-' + m;
        if (!venciByMonth[k]) venciByMonth[k] = { year: y, month: m, days: {} };
        (venciByMonth[k].days[d] = venciByMonth[k].days[d] || []).push(t);
    });
    const venciMonths = Object.values(venciByMonth).sort((a, b) => (a.year - b.year) || (a.month - b.month));

    // ===== Glossário inteligente =====
    const activeTaxNames = taxes.map(t => t.tax);
    let gloss = GLOSSARY.filter(item => item.matchTaxes.some(mt => activeTaxNames.includes(mt))).map(g => ({ acronym: g.acronym, full: g.full, desc: g.desc }));
    if (economia && economia.tipo === 'Fator R') gloss.unshift({ acronym: 'Fator R', full: 'Razão Folha ÷ Receita (RBT12)', desc: 'Proporção entre folha + pró-labore dos 12 meses e o RBT12. Igual ou acima de 28% enquadra a empresa no Anexo III (alíquotas menores) no lugar do Anexo V.' });
    if (economia && economia.tipo === 'Equiparação Hospitalar') gloss.unshift({ acronym: 'Equiparação Hospitalar', full: 'Presunção reduzida de serviços de saúde', desc: 'Permite presunção de 8% (IRPJ) e 12% (CSLL) no lugar dos 32% padrão de serviços, reduzindo a base de IRPJ e CSLL no Lucro Presumido.' });
    if (hasRetentions) gloss.push({ acronym: 'Retenção na Fonte', full: 'Antecipação de tributo', desc: 'Valor já retido e recolhido pelo tomador no pagamento da nota; é abatido do tributo apurado para chegar ao saldo líquido a pagar no mês.' });
    if (clientData.regime === 'Simples Nacional') gloss.push({ acronym: 'Anexo / Faixa', full: 'Tabela e faixa do Simples', desc: 'Definem a alíquota aplicada conforme a atividade e o faturamento acumulado dos últimos 12 meses (RBT12).' });
    gloss.push({ acronym: 'Carga tributária', full: 'Percentual sobre o faturamento', desc: 'Quanto o total de tributos do período representa sobre o faturamento.' });
    gloss.push({ acronym: 'Competência', full: 'Mês de referência', desc: 'Período a que se referem as operações e os tributos apurados neste relatório.' });
    // Glossário inteligente: qualquer tributo apurado (valor > 0) não coberto pelo glossário padrão ganha entrada automática
    const coveredNames = new Set();
    GLOSSARY.forEach(g => g.matchTaxes.forEach(mt => coveredNames.add(mt)));
    taxes.filter(t => t.tax && parseNum(t.value) > 0).forEach(t => {
        if (!coveredNames.has(t.tax) && !gloss.some(g => g.acronym.toLowerCase() === t.tax.toLowerCase())) {
            gloss.push({ acronym: t.tax, full: 'Tributo apurado', desc: (t.obs && t.obs.trim()) ? t.obs : `Tributo informado na apuração da competência${t.rate && parseNum(t.rate) > 0 ? ' · alíquota ' + String(t.rate).replace('.', ',') + '%' : ''}.` });
        }
    });
    const seenGloss = new Set();
    gloss = gloss.filter(g => { const k = g.acronym.toLowerCase(); if (seenGloss.has(k)) return false; seenGloss.add(k); return true; });

    const hasPage2 = !!economia || gloss.length > 0 || !!clientData.observations;

    const cellL = { padding: '6.5px 0', textAlign: 'left' };
    const cellR = { padding: '6.5px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
    const totL = { padding: '8px 0 0', borderTop: '2px solid #001D3D', fontWeight: 700 };
    const totR = { padding: '8px 0 0', borderTop: '2px solid #001D3D', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
    const rowBorder = { borderBottom: '1px solid #e9e6dd' };
    const thL = { textAlign: 'left', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.5px', color: '#7c8595', fontWeight: 700, padding: '0 0 6px', borderBottom: '1px solid #e9e6dd' };
    const thR = { ...thL, textAlign: 'right' };

    const Lock = () => (
        <div className="flex items-center gap-3">
            <BrandIcon />
            <div>
                <div style={{ fontFamily: "'Wildest', serif", fontWeight: 400, fontSize: 32, letterSpacing: '1.5px', lineHeight: .9, color: '#F79C04' }}>SETE</div>
                <div style={{ textTransform: 'uppercase', letterSpacing: '2.4px', fontSize: '9px', color: '#e6c884', fontWeight: 600, marginTop: 4 }}>Soluções Empresariais</div>
            </div>
        </div>
    );

    const Header = ({ kicker, title, sub }) => (
        <div className="rounded-2xl overflow-hidden avoid-break mb-4 relative" style={{ background: '#001D3D' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, #00132a 0%, #062c59 52%, #001a39 100%)' }}></div>
            <div className="relative flex justify-between items-center page-header-inner" style={{ padding: '18px 24px' }}>
                <Lock />
                <div className="text-right">
                    <div style={{ textTransform: 'uppercase', letterSpacing: '3px', fontSize: '9.5px', color: '#F79C04', fontWeight: 700 }}>{kicker}</div>
                    <div style={{ fontWeight: 700, fontSize: 20, marginTop: 2, color: '#fff' }}>{title}</div>
                    <div style={{ fontSize: '10.5px', color: '#b9c4d4', marginTop: 3 }}>{sub}</div>
                </div>
            </div>
        </div>
    );

    const Footer = ({ pageLabel }) => (
        <div className="page-footer w-full mt-auto" style={{ borderTop: '2px solid #001D3D', paddingTop: 10 }}>
            <div className="flex justify-between items-center" style={{ fontSize: '9px', color: '#646d7c' }}>
                <div>
                    <span style={{ fontWeight: 700, color: '#1a2230' }}>{OFFICE_NAME}</span>
                    {clientData.officeEmail && <span> · {clientData.officeEmail}</span>}
                    {clientData.officePhone && <span> · {clientData.officePhone}</span>}
                </div>
                <div className="text-right">Competência {clientData.competenceShort || '—'}{pageLabel ? ' · ' + pageLabel : ''}</div>
            </div>
        </div>
    );

    const SectionTitle = ({ children, right }) => (
        <div className="flex items-center gap-2 mb-3 sec-ttl" style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '10px', color: '#b06f06', fontWeight: 700 }}>
            <span style={{ width: 14, height: 2, background: '#F79C04', display: 'inline-block' }}></span>
            <span>{children}</span>
            {right && <span className="ml-auto" style={{ color: '#7c8595', fontWeight: 500, letterSpacing: '.3px', textTransform: 'none', fontSize: '9.5px' }}>{right}</span>}
        </div>
    );

    const card = "bg-white rounded-2xl border border-slate-200 shadow-sm";
    const cardPad = { padding: 16 };

    // KPI 3 e 4 variam conforme exista economia
    const kpi3 = economia
        ? { cls: 'gold', label: 'Economia gerada', value: fmtKpi(economia.valor), foot: 'via ' + economia.tipo }
        : { cls: 'gold', label: 'Alíquota efetiva', value: formatPercent(aliquotaEfetiva), foot: 'carga sobre a receita' };
    const kpi4 = economia
        ? { cls: 'w', label: 'Alíquota efetiva', value: formatPercent(aliquotaEfetiva), foot: 'carga sobre a receita' }
        : { cls: 'w', label: 'Após tributos', value: fmtKpi(liquido), foot: 'faturamento − impostos' };

    function fmtKpi(v) { return formatCurrency(v); }

    const kpiStyle = (cls) => cls === 'navy' ? { background: '#001D3D', color: '#fff', boxShadow: '0 1px 2px rgba(0,29,61,.08), 0 4px 12px rgba(0,29,61,.10)' }
        : cls === 'gold' ? { background: 'linear-gradient(160deg,#F79C04,#d4830a)', color: '#fff', boxShadow: '0 1px 2px rgba(176,111,6,.12), 0 4px 12px rgba(176,111,6,.14)' }
            : { background: '#fff', border: '1px solid #e2e8f0', color: '#1a2230', boxShadow: '0 1px 2px rgba(0,29,61,.05), 0 4px 12px rgba(0,29,61,.05)' };
    const KpiCard = ({ cls, label, value, foot }) => (
        <div className="rounded-2xl" style={{ ...cardPad, ...kpiStyle(cls) }}>
            <div style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '9.5px', fontWeight: 600, opacity: cls === 'w' ? 1 : .9, color: cls === 'w' ? '#646d7c' : undefined }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: '20px', marginTop: 8, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '9.5px', marginTop: 7, opacity: cls === 'w' ? 1 : .9, color: cls === 'w' ? '#646d7c' : undefined }}>{foot}</div>
        </div>
    );

    const CalMonthCard = ({ mo }) => {
        const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const first = new Date(mo.year, mo.month - 1, 1).getDay();
        const ndays = new Date(mo.year, mo.month, 0).getDate();
        const cells = [];
        for (let i = 0; i < first; i++) cells.push(null);
        for (let d = 1; d <= ndays; d++) cells.push(d);
        const flat = Object.values(mo.days).reduce((a, b) => a.concat(b), []);
        const mTotal = flat.reduce((s, t) => s + parseNum(t.value), 0);
        return (
            <div className={card + ' mb-4 avoid-break'} style={cardPad}>
                <SectionTitle right={`${MONTHS[mo.month - 1]}/${mo.year} · ${flat.length} guia${flat.length > 1 ? 's' : ''}`}>Calendário de vencimentos</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
                    {WD.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7c8595' }}>{w}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
                    {cells.map((d, i) => {
                        if (d === null) return <div key={i}></div>;
                        const items = mo.days[d];
                        if (!items) return <div key={i} className="cal-day" style={{ minHeight: 52, border: '1px solid #eef0f3', borderRadius: 8, padding: '5px 6px', background: '#fafbfc' }}><span style={{ fontSize: '11px', fontWeight: 700, color: '#7c8595' }}>{d}</span></div>;
                        const sub = items.reduce((s, t) => s + parseNum(t.value), 0);
                        const due = new Date(mo.year, mo.month - 1, d); const diff = Math.ceil((due - hoje) / 86400000);
                        const alert = diff <= 5;
                        return (
                            <div key={i} className="avoid-break cal-day" style={{ minHeight: 52, border: '1px solid ' + (alert ? '#f3d6cb' : '#e2e8f0'), borderRadius: 8, padding: '5px 6px', background: alert ? '#fcf1ec' : '#fff', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1a2230' }}>{d}</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                                    {items.map((t, j) => { const isDas = /^DAS/.test(t.tax); return <span key={j} style={{ fontSize: '7.5px', fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: isDas ? '#fcefd7' : '#e7ecf3', color: isDas ? '#b06f06' : '#0a3160' }}>{t.tax}</span>; })}
                                </div>
                                <span style={{ marginTop: 'auto', textAlign: 'right', paddingTop: 3, fontSize: '9px', fontWeight: 800, color: alert ? '#b5402b' : '#001D3D', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sub)}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center" style={{ gap: 16, marginTop: 14, paddingTop: 11, borderTop: '2px solid #001D3D' }}>
                    <span className="flex items-center" style={{ gap: 6, fontSize: '10px', color: '#646d7c' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#fcf1ec', border: '1px solid #f3d6cb', display: 'inline-block' }}></i> Vence em ≤5 dias</span>
                    <span className="flex items-center" style={{ gap: 6, fontSize: '10px', color: '#646d7c' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#fff', border: '1px solid #e2e8f0', display: 'inline-block' }}></i> A vencer</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#646d7c', fontWeight: 600 }}>Total a recolher <b style={{ fontSize: '15px', color: '#001D3D', fontWeight: 800, marginLeft: 6 }}>{formatCurrency(mTotal)}</b></span>
                </div>
            </div>
        );
    };

    // ===== Auto-paginação: estima a altura impressa (mm) e divide em mais páginas quando não cabe =====
    const PAGE_BUDGET_MM = 252; // conteúdo útil de uma folha após o cabeçalho da seção
    const estCalMM = (mo) => {
        const first = new Date(mo.year, mo.month - 1, 1).getDay();
        const ndays = new Date(mo.year, mo.month, 0).getDate();
        const weeks = Math.ceil((first + ndays) / 7);
        let h = 35; // título + dias da semana + legenda/total + paddings
        for (let w = 0; w < weeks; w++) {
            let cell = 12;
            for (let d = 1; d <= ndays; d++) {
                if (Math.floor((first + d - 1) / 7) !== w) continue;
                const items = mo.days[d];
                if (items) cell = Math.max(cell, 8 + Math.ceil(items.length / 1.7) * 3.7 + 3.5);
            }
            h += cell;
        }
        return h;
    };
    const numDatasVenc = withDue.length > 0 ? new Set(withDue.map(t => t.dueDate)).size : 0;
    const estTabelaGuiasMM = 14 + numDatasVenc * 10 + 7; // detalhamento agrupado por data (cada linha pode quebrar em 2)
    const vencSplit = venciMonths.length > 0 && (estCalMM(venciMonths[0]) + 32 + estTabelaGuiasMM + 10 > PAGE_BUDGET_MM);

    // Indicadores e detalhamento calculados uma vez (usados na página única ou divididos em duas)
    let vencIndicadores = null, vencDetalhamento = null;
    if (withDue.length > 0) {
        const parseDMY = s => { const p = s.split('/'); return new Date(+p[2], +p[1] - 1, +p[0]); };
        const sortedG = [...withDue].sort((a, b) => parseDMY(a.dueDate) - parseDMY(b.dueDate));
        const hojeG = new Date(); hojeG.setHours(0, 0, 0, 0);
        const prox = sortedG.find(t => parseDMY(t.dueDate) >= hojeG) || sortedG[0];
        const proxItens = sortedG.filter(t => t.dueDate === prox.dueDate);
        const proxVal = proxItens.reduce((s, t) => s + parseNum(t.value), 0);
        const datas = new Set(withDue.map(t => t.dueDate)).size;
        const maior = sortedG.reduce((m, t) => parseNum(t.value) > parseNum(m.value) ? t : m, sortedG[0]);
        const fmtD = s => { const p = s.split('/'); return p[0] + ' ' + MES_ABBR[(+p[1] || 1) - 1]; };
        const diff = Math.ceil((parseDMY(prox.dueDate) - hojeG) / 86400000);
        const prazo = diff < 0 ? 'vencido' : diff === 0 ? 'vence hoje' : 'vence em ' + diff + ' dia' + (diff > 1 ? 's' : '');
        const kl = { textTransform: 'uppercase', letterSpacing: '1px', fontSize: '9.5px', fontWeight: 600 };
        vencIndicadores = (
            <div className="grid grid-cols-3 gap-3 mb-4 avoid-break">
                <div className="rounded-2xl" style={{ padding: 15, background: '#001D3D', color: '#fff' }}>
                    <div style={{ ...kl, opacity: .85 }}>Proximo vencimento</div>
                    <div style={{ fontWeight: 800, fontSize: '18px', marginTop: 6 }}>{fmtD(prox.dueDate)}</div>
                    <div style={{ fontSize: '9.5px', marginTop: 6, opacity: .85 }}>{proxItens.map(t => t.tax).join(', ')} - {formatCurrency(proxVal)} - {prazo}</div>
                </div>
                <div className="rounded-2xl" style={{ padding: 15, background: 'linear-gradient(160deg,#F79C04,#d4830a)', color: '#fff' }}>
                    <div style={{ ...kl, opacity: .9 }}>Total a recolher</div>
                    <div style={{ fontWeight: 800, fontSize: '18px', marginTop: 6 }}>{formatCurrency(totalDue)}</div>
                    <div style={{ fontSize: '9.5px', marginTop: 6, opacity: .9 }}>{withDue.length} guia{withDue.length > 1 ? 's' : ''} em {datas} data{datas > 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-2xl" style={{ padding: 15, background: '#fff', border: '1px solid #e2e8f0' }}>
                    <div style={{ ...kl, color: '#646d7c' }}>Maior guia</div>
                    <div style={{ fontWeight: 800, fontSize: '18px', marginTop: 6, color: '#1a2230' }}>{formatCurrency(parseNum(maior.value))}</div>
                    <div style={{ fontSize: '9.5px', marginTop: 6, color: '#646d7c' }}>{maior.tax} - {fmtD(maior.dueDate)}</div>
                </div>
            </div>
        );
        // Agrupa as guias por data de vencimento (sortedG já está em ordem cronológica)
        const grupos = [];
        sortedG.forEach(t => {
            const last = grupos[grupos.length - 1];
            if (last && last.dueDate === t.dueDate) { last.itens.push(t); last.total += parseNum(t.value); }
            else grupos.push({ dueDate: t.dueDate, itens: [t], total: parseNum(t.value) });
        });
        vencDetalhamento = (
            <div className={card} style={cardPad}>
                <SectionTitle right={`${grupos.length} data${grupos.length > 1 ? 's' : ''} · ${withDue.length} guia${withDue.length > 1 ? 's' : ''}`}>Detalhamento das guias</SectionTitle>
                <table className="w-full" style={{ fontSize: '11px', borderCollapse: 'collapse' }}>
                    <tbody>
                        {grupos.map((g, i) => {
                            const bd = i < grupos.length - 1 ? rowBorder : {};
                            return (
                                <tr key={i}>
                                    <td style={{ ...cellL, ...bd, width: 64, fontWeight: 700, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fmtD(g.dueDate)}</td>
                                    <td style={{ ...cellL, ...bd, color: '#646d7c', paddingLeft: 10, paddingRight: 10 }}>{g.itens.map(t => t.tax).join(', ')}</td>
                                    <td style={{ ...cellR, ...bd, fontWeight: 700, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{formatCurrency(g.total)}</td>
                                </tr>
                            );
                        })}
                        <tr><td style={totL} colSpan="2">Total a recolher</td><td style={totR}>{formatCurrency(totalDue)}</td></tr>
                    </tbody>
                </table>
            </div>
        );
    }

    // Gráfico de evolução vira página própria quando o Resumo (muitos tributos) não comporta os dois
    const evolucaoCard = (Array.isArray(clientData.evolucao) && clientData.evolucao.some(p => p.receita > 0)) ? (() => {
        const ev = clientData.evolucao;
        const fmtMil = (v) => v <= 0 ? '' : (v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : Math.round(v).toString());
        const mx = Math.max(...ev.map(p => p.receita), 1);
        const media = ev.reduce((s, p) => s + p.receita, 0) / ev.length;
        const ult = ev[ev.length - 1].receita, pen = ev.length > 1 ? ev[ev.length - 2].receita : 0;
        const varPct = pen > 0 ? ((ult - pen) / pen * 100) : null;
        return (
            <div className={card + ' mb-4 avoid-break'} style={cardPad}>
                <SectionTitle right="notas emitidas · últimos 12 meses">Evolução do faturamento</SectionTitle>
                <div className="evo-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 118, borderBottom: '1.5px solid #e9e6dd', paddingTop: 6 }}>
                    {ev.map((p, i) => (
                        <div key={i} title={`${p.ym}: ${formatCurrency(p.receita)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            <div style={{ fontSize: 7, lineHeight: 1, color: i === ev.length - 1 ? '#b06f06' : '#646d7c', fontWeight: 700, marginBottom: 3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMil(p.receita)}</div>
                            <div style={{ width: '100%', maxWidth: 22, height: Math.max(p.receita / mx * 82, p.receita > 0 ? 2 : 0) + '%', background: i === ev.length - 1 ? '#F79C04' : '#001D3D', borderRadius: '3px 3px 0 0' }}></div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                    {ev.map((p, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: i === ev.length - 1 ? '#b06f06' : '#646d7c', fontWeight: i === ev.length - 1 ? 700 : 500 }}>{MES_ABBR[(parseInt(p.ym.slice(0, 2)) || 1) - 1]}</div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 9, fontSize: 10, color: '#646d7c', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: '#001D3D', display: 'inline-block' }}></i> Meses anteriores</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: '#F79C04', display: 'inline-block' }}></i> Competência</span>
                    <span style={{ marginLeft: 'auto', color: '#b06f06', fontWeight: 600 }}>Média {formatCurrency(media)}{varPct !== null ? ` · ${varPct >= 0 ? '▲' : '▼'} ${Math.abs(varPct).toFixed(1).replace('.', ',')}% no mês` : ''}</span>
                </div>
            </div>
        );
    })() : null;
    const estImpostosMM = 14 + taxRows.length * 6.6 + 8;
    const estResumoBaseMM = 26 + 15 + 21 + 12 + (hasRetentions ? 32 + estImpostosMM : Math.max(34, estImpostosMM)) + ((clientData.irpjCsllMode === 'Trimestral (Apuração)' || clientData.irpjCsllMode === 'Estimativa (Anual)') && parseNum(clientData.periodRevenue) > 0 ? 8 : 0);
    const evolucaoSeparada = !!evolucaoCard && (estResumoBaseMM + 46 > PAGE_BUDGET_MM);

    return (
        <div className="max-w-[210mm] mx-auto print-wrapper">
            {/* ===== PÁGINA 1 ===== */}
            <div className="report-preview mb-8">
                <div className="report-preview-body">
                    <Header kicker="Relatório Mensal" title="Resumo Fiscal" sub={`Competência ${compLabel}`} />

                    <div className={card + ' flex mb-4 avoid-break'} style={{ padding: '12px 18px' }}>
                        {[
                            { l: 'Cliente', v: clientData.clientName || 'NOME DA EMPRESA' },
                            { l: 'CNPJ', v: clientData.cnpj || '—' },
                            { l: 'Regime', v: clientData.regime || '—' },
                            { l: isSN ? 'Anexo / Faixa' : 'Atividade', v: (isSN ? anexoEfetivo : clientData.atividade) || '—' },
                        ].map((it, i) => (
                            <div key={i} className="flex-1" style={i ? { borderLeft: '1px solid #e9e6dd', paddingLeft: 18 } : {}}>
                                <div style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '9px', color: '#7c8595', fontWeight: 700 }}>{it.l}</div>
                                <div style={{ fontSize: '12px', fontWeight: 600, marginTop: 3 }}>{it.v}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-4 avoid-break">
                        <KpiCard cls="navy" label="Faturamento" value={fmtKpi(revenue)} foot="Receita bruta do mês" />
                        <KpiCard cls="w" label="Total a pagar" value={fmtKpi(totalTributos)} foot={hasRetentions ? 'líquido após retenção' : `${formatPercent(aliquotaEfetiva)} do faturamento`} />
                        <KpiCard cls={kpi3.cls} label={kpi3.label} value={kpi3.value} foot={kpi3.foot} />
                        <KpiCard cls={kpi4.cls} label={kpi4.label} value={kpi4.value} foot={kpi4.foot} />
                    </div>

                    {(clientData.irpjCsllMode === 'Trimestral (Apuração)' || clientData.irpjCsllMode === 'Estimativa (Anual)') && parseNum(clientData.periodRevenue) > 0 && (
                        <div className="avoid-break flex items-center gap-2" style={{ fontSize: '10px', color: '#646d7c', margin: '-2px 2px 12px' }}>
                            <span style={{ width: 14, height: 2, background: '#F79C04', display: 'inline-block', flexShrink: 0 }}></span>
                            <span>IRPJ e CSLL apurados sobre o <b style={{ color: '#1a2230' }}>faturamento acumulado do período: {formatCurrency(clientData.periodRevenue)}</b> · {clientData.irpjCsllMode}</span>
                        </div>
                    )}

                    {!hasRetentions ? (
                        <div className={'grid grid-cols-2 gap-3 mb-4' + (taxRows.length > 16 ? '' : ' avoid-break')}>
                            <div className={card} style={cardPad}>
                                <SectionTitle>Faturamento</SectionTitle>
                                <table className="w-full" style={{ fontSize: '11.5px', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {fatRows.map((r, i) => (
                                            <tr key={i}><td style={{ ...cellL, ...(i < fatRows.length - 1 ? rowBorder : {}) }}>{r.label}</td><td style={{ ...cellR, ...(i < fatRows.length - 1 ? rowBorder : {}) }}>{formatCurrency(r.val)}</td></tr>
                                        ))}
                                        <tr><td style={totL}>Faturamento bruto</td><td style={totR}>{formatCurrency(revenue)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className={card} style={cardPad}>
                                <SectionTitle right={`${taxRows.length} tributo${taxRows.length > 1 ? 's' : ''}`}>Impostos apurados</SectionTitle>
                                <table className="w-full" style={{ fontSize: '11.5px', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {taxRows.map((t, i) => (
                                            <tr key={i}>
                                                <td style={{ ...cellL, ...(i < taxRows.length - 1 ? rowBorder : {}) }}>
                                                    {t.tax}{t.rate && parseNum(t.rate) > 0 ? <span style={{ color: '#7c8595', fontWeight: 500 }}> · {String(t.rate).replace('.', ',')}%</span> : null}
                                                </td>
                                                <td style={{ ...cellR, ...(i < taxRows.length - 1 ? rowBorder : {}) }}>{formatCurrency(parseNum(t.value))}</td>
                                            </tr>
                                        ))}
                                        <tr><td style={totL}>Total a recolher</td><td style={totR}>{formatCurrency(totalTributos)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className={card + ' mb-4 avoid-break'} style={cardPad}>
                                <SectionTitle right="receita do período">Faturamento</SectionTitle>
                                <table className="w-full" style={{ fontSize: '11.5px', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {fatRows.map((r, i) => (
                                            <tr key={i}><td style={{ ...cellL, ...(i < fatRows.length - 1 ? rowBorder : {}) }}>{r.label}</td><td style={{ ...cellR, ...(i < fatRows.length - 1 ? rowBorder : {}) }}>{formatCurrency(r.val)}</td></tr>
                                        ))}
                                        <tr><td style={totL}>Faturamento bruto</td><td style={totR}>{formatCurrency(revenue)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className={card + ' mb-4'} style={cardPad}>
                                <SectionTitle right={`${taxRows.length} tributos · retenção abatida`}>Impostos apurados</SectionTitle>
                                <table className="w-full" style={{ fontSize: '11px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thL}>Tributo</th>
                                            <th style={thR}>Apurado</th>
                                            <th style={thR}>Retido</th>
                                            <th style={thR}>A pagar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taxRows.map((t, i) => {
                                            const ap = parseNum(t.apurado) || parseNum(t.value);
                                            const re = parseNum(t.retido);
                                            const bd = i < taxRows.length - 1 ? rowBorder : {};
                                            return (
                                                <tr key={i}>
                                                    <td style={{ ...cellL, ...bd }}>{t.tax}{t.rate && parseNum(t.rate) > 0 ? <span style={{ color: '#7c8595', fontWeight: 500 }}> · {String(t.rate).replace('.', ',')}%</span> : null}</td>
                                                    <td style={{ ...cellR, ...bd }}>{formatCurrency(ap)}</td>
                                                    <td style={{ ...cellR, ...bd, color: re > 0 ? '#1f7a4d' : '#7c8595' }}>{re > 0 ? '− ' + formatCurrency(re) : '—'}</td>
                                                    <td style={{ ...cellR, ...bd, fontWeight: 700 }}>{formatCurrency(parseNum(t.value))}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td style={totL}>Total</td>
                                            <td style={totR}>{formatCurrency(totalApurado)}</td>
                                            <td style={{ ...totR, color: '#1f7a4d' }}>{totalRetido > 0 ? '− ' + formatCurrency(totalRetido) : '—'}</td>
                                            <td style={totR}>{formatCurrency(totalTributos)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}

                    {!evolucaoSeparada && evolucaoCard}

                </div>
                <Footer />
            </div>

            {/* Evolução em página própria quando o Resumo está cheio (muitos tributos) */}
            {evolucaoSeparada && (
                <div className="report-preview">
                    <div className="report-preview-body">
                        <Header kicker="Relatório Mensal" title="Evolução do Faturamento" sub={`${clientData.clientName || 'Empresa'} · ${compLabel}`} />
                        {evolucaoCard}
                    </div>
                    <Footer />
                </div>
            )}

{/* ===== PAGINA - VENCIMENTOS ===== */}
            {withDue.length > 0 && (
                <div className="report-preview">
                    <div className="report-preview-body">
                        <Header kicker="Relatório Mensal" title="Vencimentos" sub={`${clientData.clientName || 'Empresa'} · ${compLabel}`} />
                        <CalMonthCard mo={venciMonths[0]} />
                        {vencIndicadores}
                        {!vencSplit && vencDetalhamento}
                    </div>
                    <Footer />
                </div>
            )}

            {/* Detalhamento em página própria quando calendário + tabela não cabem juntos */}
            {withDue.length > 0 && vencSplit && (
                <div className="report-preview">
                    <div className="report-preview-body">
                        <Header kicker="Relatório Mensal" title="Vencimentos — detalhamento" sub={`${clientData.clientName || 'Empresa'} · ${compLabel}`} />
                        {vencDetalhamento}
                    </div>
                    <Footer />
                </div>
            )}

            {/* Meses extras do calendário — cada um em página própria para não estourar a folha */}
            {venciMonths.slice(1).map((mo, i) => (
                <div className="report-preview" key={'vm' + i}>
                    <div className="report-preview-body">
                        <Header kicker="Relatório Mensal" title="Vencimentos — continuação" sub={`${clientData.clientName || 'Empresa'} · ${compLabel}`} />
                        <CalMonthCard mo={mo} />
                    </div>
                    <Footer />
                </div>
            ))}

                        {/* ===== PÁGINA 2 ===== */}
            {hasPage2 && (
                <div className="report-preview">
                    <div className="report-preview-body">
                        <Header kicker="Relatório Mensal" title={economia ? 'Economia & Glossário' : 'Glossário'} sub={`${clientData.clientName || 'Empresa'} · ${compLabel}`} />

                        {economia && (
                            <div className={card + ' mb-4 avoid-break'} style={cardPad}>
                                <SectionTitle right={economia.tipo}>Economia tributária — de onde vem</SectionTitle>
                                <div className="flex items-stretch gap-4">
                                    <div style={{ flex: '0 0 210px', background: 'linear-gradient(160deg,#fff,#fcefd7)', border: '1px solid #F79C04', borderRadius: 12, padding: '16px 17px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ textTransform: 'uppercase', letterSpacing: '1.2px', fontSize: '9.5px', color: '#b06f06', fontWeight: 700 }}>Economia no mês</div>
                                        <div style={{ fontWeight: 800, fontSize: 34, color: '#b06f06', lineHeight: 1, marginTop: 7 }}>{formatCurrency(economia.valor)}</div>
                                        <div style={{ fontSize: '10.5px', color: '#1a2230', marginTop: 9, lineHeight: 1.45 }}>gerada pelo enquadramento em <b style={{ color: '#b06f06' }}>{economia.tipo}</b>. Projeção de <b style={{ color: '#b06f06' }}>{formatCurrency(economia.valor * 12)}</b> em 12 meses mantida a condição.</div>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center" style={{ gap: 13 }}>
                                        <div>
                                            <div className="flex justify-between items-baseline" style={{ fontSize: 11, marginBottom: 5 }}><b style={{ fontWeight: 600 }}>{economia.semLabel}</b><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{formatCurrency(economia.semVal)}</span></div>
                                            <div style={{ height: 22, borderRadius: 6, background: '#f0f2f5', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: '100%', background: '#001D3D' }}></i></div>
                                            <small style={{ fontSize: 9, color: '#7c8595' }}>{economia.semExtra}</small>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-baseline" style={{ fontSize: 11, marginBottom: 5 }}><b style={{ fontWeight: 600 }}>{economia.comLabel}</b><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{formatCurrency(economia.comVal)}</span></div>
                                            <div style={{ height: 22, borderRadius: 6, background: '#f0f2f5', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: (economia.semVal > 0 ? Math.max(6, economia.comVal / economia.semVal * 100) : 100) + '%', background: 'linear-gradient(90deg,#F79C04,#d4830a)' }}></i></div>
                                            <small style={{ fontSize: 9, color: '#7c8595' }}>{economia.comExtra}</small>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 13, fontSize: '10.5px', color: '#646d7c', lineHeight: 1.5, borderTop: '1px dashed #e9e6dd', paddingTop: 11 }}>
                                    <b style={{ color: '#1a2230' }}>Como calculamos.</b> {economia.explica} A diferença entre os dois cenários é a economia que o enquadramento atual gera, todo mês.
                                </div>
                            </div>
                        )}

                        {gloss.length > 0 && (
                            <div className={card + ' mb-4'} style={cardPad}>
                                <SectionTitle right="termos do seu relatório">Glossário inteligente</SectionTitle>
                                <div className="grid grid-cols-2" style={{ gap: '10px 26px' }}>
                                    {gloss.map((item, i) => (
                                        <div key={i} className="avoid-break" style={{ paddingBottom: 9, borderBottom: '1px solid #e9e6dd' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#001D3D' }}>
                                                <span style={{ color: '#b06f06', fontWeight: 700, marginRight: 5 }}>{item.acronym}</span>{item.full}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#646d7c', lineHeight: 1.4, marginTop: 2 }}>{item.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {clientData.observations && (
                            <div className={card + ' mb-4 avoid-break'} style={cardPad}>
                                <SectionTitle>Observações da apuração</SectionTitle>
                                <p style={{ fontSize: '11px', color: '#1a2230', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{clientData.observations}</p>
                            </div>
                        )}

                        <div className={card + ' avoid-break'} style={cardPad}>
                            <SectionTitle>Informações importantes</SectionTitle>
                            <ul style={{ fontSize: '10.5px', color: '#646d7c', lineHeight: 1.6, listStyle: 'none', margin: 0, padding: 0 }}>
                                <li>• Os valores correspondem à apuração do período indicado.</li>
                                {hasRetentions && <li>• O total da competência considera o abatimento das retenções na fonte.</li>}
                                <li>• As alíquotas podem variar conforme atividade, município e regime tributário.</li>
                                <li>• Este demonstrativo não substitui as guias oficiais de recolhimento.</li>
                            </ul>
                        </div>
                    </div>
                    <Footer />
                </div>
            )}
        </div>
    );
};

const Toast = ({ message, type = 'success', onClose }) => {
    const [hiding, setHiding] = useState(false);
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;
    React.useEffect(() => {
        setHiding(false);
        const timer = setTimeout(() => {
            setHiding(true);
            setTimeout(() => onCloseRef.current(), 300);
        }, 2800);
        return () => clearTimeout(timer);
    }, [message, type]);
    const icons = {
        success: <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>,
        warning: <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">!</div>,
        error: <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✕</div>,
    };
    return (
        <div className={`toast toast-${type} ${hiding ? 'hiding' : ''}`}>
            {icons[type]}
            {message}
        </div>
    );
};

const LoadingOverlay = () => (
    <div className="pdf-loading-overlay no-print">
        <div className="pdf-loading-spinner"></div>
        <p className="text-sm font-bold text-navy uppercase tracking-wide">Preparando PDF...</p>
        <p className="text-xs text-slate-400">O diálogo de impressão abrirá em instantes</p>
    </div>
);


/* ===== Painel-resumo ao vivo (coluna direita do editor) =====
   Calcula em tempo real a partir de clientData + taxes. Estilo 100% nos tokens do app. */
const LiveSummary = ({ clientData, taxes }) => {
    const ehRetido = (t) => /\(retido\)/i.test(t.tax || ''); // linhas informativas, não são guia
    const revenue = calculateTotalRevenue(clientData);
    const totalApurado = taxes.reduce((s, t) => s + (ehRetido(t) ? 0 : (parseNumBR(t.apurado) || parseNumBR(t.value))), 0);
    const totalPagar = taxes.reduce((s, t) => s + (ehRetido(t) ? 0 : parseNumBR(t.value)), 0);
    const totalRetido = taxes.reduce((s, t) => s + parseNumBR(t.retido), 0);
    const aliquota = revenue > 0 ? (totalApurado / revenue) * 100 : 0;
    const guias = taxes.filter(t => t.tax && !ehRetido(t) && parseNumBR(t.value) > 0);

    const isSN = clientData.regime === 'Simples Nacional' || clientData.regime === 'MEI';
    const dasTax = taxes.find(t => /^DAS/.test(t.tax || ''));
    const das = dasTax ? parseNumBR(dasTax.value) : 0;

    const rbt12 = parseNumBR(clientData.rbt12);
    const acimaSublimite = clientData.regime === 'Simples Nacional' && rbt12 > SUBLIMITE_SN;
    const acimaTeto = clientData.regime === 'Simples Nacional' && rbt12 > LIMITE_SN;
    const folha12m = parseNumBR(clientData.folha12m);
    const fR = calcFatorR(folha12m, rbt12);
    const showFatorR = clientData.regime === 'Simples Nacional' && (clientData.anexo === 'Anexo III' || clientData.anexo === 'Anexo V') && rbt12 > 0;
    const anexoEf = showFatorR ? getAnexoEfetivo(clientData.anexo, fR, isSujeitoFatorR(clientData, folha12m)) : null;
    const fatorOk = fR >= 28;

    // próximo vencimento
    const valid = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s || '');
    const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const withDue = taxes
        .filter(t => t.tax && valid(t.dueDate) && parseNumBR(t.value) > 0)
        .sort((a, b) => { const pa = a.dueDate.split('/'), pb = b.dueDate.split('/'); return new Date(pa[2], pa[1] - 1, pa[0]) - new Date(pb[2], pb[1] - 1, pb[0]); });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const prox = withDue.find(t => { const p = t.dueDate.split('/'); return new Date(p[2], p[1] - 1, p[0]) >= today; }) || withDue[0];
    const proxLabel = prox ? `${prox.dueDate.slice(0, 2)} ${MES_ABBR[(parseInt(prox.dueDate.slice(3, 5)) || 1) - 1]}` : '—';
    const proxDiff = prox ? Math.ceil((new Date(prox.dueDate.split('/')[2], prox.dueDate.split('/')[1] - 1, prox.dueDate.split('/')[0]) - today) / 86400000) : null;

    const Row = ({ label, children }) => (
        <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-semibold tabular-nums">{children}</span>
        </div>
    );

    if (revenue <= 0) {
        return (
            <Card className="p-5 lg:sticky lg:top-4 no-print">
                <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-muted-foreground/40" /></span>
                    <h3 className="text-sm font-semibold">Resumo ao vivo</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                    Selecione a empresa e informe o <b>faturamento do mês</b> (ou importe o PGDAS-D) para ver aqui, em tempo real, o total a pagar, a alíquota efetiva e os vencimentos.
                </p>
            </Card>
        );
    }

    return (
        <Card className="p-5 lg:sticky lg:top-4 no-print gap-4">
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                <h3 className="text-sm font-semibold">Resumo ao vivo</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{clientData.competenceShort || ''}</span>
            </div>

            {/* Hero — total a pagar */}
            <div className="rounded-lg bg-primary text-primary-foreground p-4">
                <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Total a pagar</p>
                <p className="text-3xl font-bold leading-none mt-1.5 tabular-nums">{formatCurrency(totalPagar)}</p>
                <p className="text-[11px] opacity-80 mt-2">{formatPercent(aliquota)} sobre o faturamento{totalRetido > 0 ? ` · retenção ${formatCurrency(totalRetido)}` : ''}</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Faturamento</p>
                    <p className="text-base font-bold mt-1 tabular-nums">{formatCurrency(revenue)}</p>
                </div>
                <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Alíquota efetiva</p>
                    <p className="text-base font-bold mt-1 tabular-nums">{formatPercent(aliquota)}</p>
                </div>
            </div>

            {acimaSublimite && (
                <div className={"rounded-lg border p-3 text-xs " + (acimaTeto ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-warning/10 border-warning/30 text-warning")}>
                    <p className="font-bold">{acimaTeto ? 'RBT12 acima do teto do Simples (R$ 4,8 mi)' : 'RBT12 acima do sublimite (R$ 3,6 mi)'}</p>
                    <p className="opacity-90 mt-0.5">{acimaTeto ? 'Possível desenquadramento do Simples — confira o enquadramento.' : 'ICMS/ISS devem ser recolhidos FORA do DAS, por apuração estadual/municipal própria.'}</p>
                </div>
            )}

            {/* Detalhes */}
            <div className="mt-1">
                {isSN && das > 0 && <Row label="DAS do mês">{formatCurrency(das)}</Row>}
                {showFatorR && (
                    <Row label="Fator R">
                        <span className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold " + (fatorOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                            {fR.toFixed(1).replace('.', ',')}% · {anexoEf}
                        </span>
                    </Row>
                )}
                <Row label="Guias">{guias.length}{guias.length === 1 ? ' guia' : ' guias'}</Row>
                {prox && (
                    <Row label="Próximo vencimento">
                        <span className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold " + (proxDiff != null && proxDiff <= 5 ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground")}>
                            {proxLabel}{proxDiff != null ? ` · ${proxDiff < 0 ? 'vencido' : proxDiff === 0 ? 'hoje' : proxDiff + 'd'}` : ''}
                        </span>
                    </Row>
                )}
            </div>
        </Card>
    );
};

const blankClient = () => ({
    clientName: "", cnpj: "", competence: "", competenceShort: "",
    regime: "Lucro Presumido", revenueRetained: "", revenueNonRetained: ""
});

const App = () => {
    // ?view=preview abre direto na visualização (links e verificação automatizada)
    const [tab, setTab] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'preview') ? 'preview' : 'edit');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    // ---- Integração com o controle fiscal ----
    const { clients } = useData();
    const [clientId, setClientId] = useState("");
    const [records, setRecords] = useState([]);

    const [clientData, setClientData] = useState(blankClient);
    const [taxes, setTaxes] = useState(DEFAULT_TAXES);

    const mapAtividade = (b) => {
        if (!b) return 'Serviços';
        const s = String(b).toLowerCase();
        if (s.startsWith('com')) return 'Comércio';
        if (s.startsWith('ind')) return 'Indústria';
        return 'Serviços';
    };

    const loadRecords = async (id) => {
        try { setRecords(await getApuracoes(id)); } catch { setRecords([]); }
    };

    const selectClient = async (id) => {
        setClientId(id);
        if (!id) { setRecords([]); return; }
        const c = clients.find(x => x.id === id);
        if (c) {
            setClientData(prev => ({
                ...prev,
                clientId: id,
                clientName: c.name || prev.clientName,
                cnpj: c.cnpj ? formatCNPJ(c.cnpj) : prev.cnpj,
                regime: c.taxRegime ? (TAX_REGIME_LABELS[c.taxRegime] || prev.regime) : prev.regime,
                atividade: mapAtividade(c.businessActivity) || prev.atividade,
            }));
        }
        await loadRecords(id);
    };

    const compKeyOf = (cd) => (cd.compYear && cd.compMonth) ? `${cd.compYear}-${String(cd.compMonth).padStart(2, '0')}` : '';

    const saveComp = async () => {
        if (!clientId) { setToast({ message: 'Selecione a empresa do controle fiscal.', type: 'error' }); return; }
        const compKey = compKeyOf(clientData);
        if (!compKey) { setToast({ message: 'Informe mês e ano da competência.', type: 'error' }); return; }
        const totalPagar = taxes.reduce((s, t) => s + parseNumBR(t.value), 0);
        const totalApurado = taxes.reduce((s, t) => s + (parseNumBR(t.apurado) || parseNumBR(t.value)), 0);
        const revenue = calculateTotalRevenue(clientData);
        const das = taxes.filter(t => /^DAS/.test(t.tax)).reduce((s, t) => s + parseNumBR(t.value), 0);
        const rec = {
            clientId,
            compKey,
            competenceShort: clientData.competenceShort || (String(clientData.compMonth || '').padStart(2, '0') + '/' + (clientData.compYear || '')),
            regime: clientData.regime,
            anexo: clientData.anexo,
            atividade: clientData.atividade,
            faturamento: revenue,
            rbt12: parseNumBR(clientData.rbt12),
            folha12m: parseNumBR(clientData.folha12m),
            proLabore: parseNumBR(clientData.proLabore),
            totalTributos: totalApurado,
            totalPagar,
            aliquotaEfetiva: revenue > 0 ? (totalApurado / revenue) * 100 : 0,
            economia: 0,
            das,
            payload: { clientData, taxes },
        };
        try {
            await saveApuracao(rec);
            await loadRecords(clientId);
            setToast({ message: `Competência ${rec.competenceShort} salva.`, type: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ message: 'Erro ao salvar a competência.', type: 'error' });
        }
    };

    const delComp = async (compKey) => {
        try {
            await deleteApuracao(clientId, compKey);
            await loadRecords(clientId);
            setToast({ message: 'Competência removida.', type: 'warning' });
        } catch { setToast({ message: 'Erro ao remover.', type: 'error' }); }
    };

    const reopenRecord = (rec) => {
        if (!rec || !rec.payload) return;
        const p = rec.payload;
        if (p.clientData) setClientData({ ...p.clientData, clientId });
        if (Array.isArray(p.taxes)) setTaxes(p.taxes);
        setValidationErrors({});
        setTab('edit');
    };

    // Ref evita closure obsoleta: o atalho sempre usa a versão atual de handlePrint (dados atuais)
    const handlePrintRef = React.useRef(() => { });
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                handlePrintRef.current();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const clearForm = () => {
        setClientData(clientId ? { ...blankClient(), clientId } : blankClient());
        setTaxes(DEFAULT_TAXES);
        setValidationErrors({});
        setToast({ message: 'Formulário limpo.', type: 'warning' });
    };

    const validate = () => {
        const errors = {};
        if (!clientData.clientName?.trim()) errors.clientName = 'Nome é obrigatório';
        if (!clientData.competenceShort?.trim()) errors.competence = 'Competência é obrigatória';

        // Bloqueia competência futura (apura-se mês já encerrado)
        if (clientData.compYear && clientData.compMonth) {
            const now = new Date();
            const comp = new Date(parseInt(clientData.compYear), parseInt(clientData.compMonth) - 1, 1);
            const mesAtual = new Date(now.getFullYear(), now.getMonth(), 1);
            if (comp > mesAtual) errors.competence = 'Competência futura — selecione um mês já encerrado';
        }

        // MEI sem faturamento ainda deve o DAS fixo — o relatório de vencimentos continua útil
        const totalRev = parseNumBR(clientData.revenueRetained) + parseNumBR(clientData.revenueNonRetained) + parseNumBR(clientData.revenue);
        if (totalRev <= 0 && clientData.regime !== 'MEI') errors.revenue = 'O faturamento total (soma) deve ser maior que zero';

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handlePrint = () => {
        if (!validate()) {
            setTab('edit');
            setToast({ message: 'Preencha os campos obrigatórios destacados', type: 'error' });
            return;
        }
        setLoading(true);
        setTab('preview');
        setTimeout(() => {
            setLoading(false);
            const empresa = (clientData.clientName || '').trim();
            const mes = (clientData.competence || clientData.competenceShort || '').trim();
            const oldTitle = document.title;
            if (empresa) {
                document.title = `Apuração Fiscal ${mes}${mes ? ' - ' : ''}${empresa}`
                    .replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
            }
            const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
            window.addEventListener('afterprint', restore);
            window.print();
            setTimeout(restore, 2000);
        }, 600);
    };
    handlePrintRef.current = handlePrint;

    const handleWhatsAppCopy = () => {
        const total = taxes.reduce((sum, r) => sum + parseNumBR(r.value), 0);
        if (total <= 0) {
            setToast({ message: 'Nenhum valor apurado para copiar.', type: 'warning' });
            return;
        }

        const list = taxes
            .filter(t => t.tax && parseNumBR(t.value) > 0)
            .map(t => `${t.tax}: ${t.dueDate || '—'} - ${formatCurrency(t.value)}`)
            .join('\n');

        const text = `Olá! Segue a apuração fiscal referente ao mês de *${clientData.competenceShort || '—'}*:\n\n${list}\n\nTOTAL A PAGAR: ${formatCurrency(total)}`;

        if (!navigator.clipboard) {
            setToast({ message: 'Navegador sem suporte a copiar — use HTTPS ou copie manualmente', type: 'warning' });
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            setToast({ message: 'Resumo copiado!', type: 'success' });
        }).catch(() => {
            setToast({ message: 'Erro ao copiar para área de transferência', type: 'error' });
        });
    };

    return (
        <div className="px-4 lg:px-6 xl:px-8 py-5">
            <style dangerouslySetInnerHTML={{ __html: SETE_STYLES }} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {loading && <LoadingOverlay />}

            {/* Cabeçalho do módulo — mesmo padrão das demais telas do controle fiscal */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5 no-print">
                <PageHeader
                    icon={TrendingUp}
                    title="Relatório Executivo"
                    description="Apuração fiscal mensal do cliente e relatório executivo em PDF · tabelas e valores vigentes em 2026."
                />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={saveComp} title="Salvar competência da empresa selecionada">
                        <Save className="h-4 w-4" /> Salvar competência
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleWhatsAppCopy} title="Copiar resumo para WhatsApp">
                        <MessageSquare className="h-4 w-4" /> WhatsApp
                    </Button>
                    <Button size="sm" onClick={handlePrint} title="Exportar PDF (Ctrl+P)">
                        <Printer className="h-4 w-4" /> Exportar PDF
                    </Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="no-print mb-4">
                    <TabsTrigger value="edit"><Edit3 className="h-4 w-4 mr-1.5" /> Editar</TabsTrigger>
                    <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1.5" /> Visualizar</TabsTrigger>
                </TabsList>

                {/* ===================== EDITAR ===================== */}
                <TabsContent value="edit">
                    {/* Empresa do controle fiscal + histórico de competências */}
                    <Card className="p-5 mb-5 no-print">
                        <div className="flex flex-col md:flex-row md:items-end gap-4">
                            <div className="flex-1 min-w-0">
                                <Label className="mb-1.5 block">Empresa (do controle fiscal)</Label>
                                <Select value={clientId} onValueChange={selectClient}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                    <SelectContent>
                                        {clients.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}{c.cnpj ? ` — ${formatCNPJ(c.cnpj)}` : ''}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="ghost" size="sm" onClick={clearForm} title="Limpar o formulário">
                                    <Trash2 className="h-4 w-4" /> Limpar
                                </Button>
                                <p className="text-xs text-muted-foreground max-w-[240px] leading-snug hidden lg:block">
                                    Selecionar a empresa preenche nome, CNPJ, regime e atividade.
                                </p>
                            </div>
                        </div>
                        {clientId && (
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Competências salvas</p>
                                {records.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Nenhuma competência salva para esta empresa ainda.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {records.slice().sort((a, b) => a.compKey.localeCompare(b.compKey)).map((r) => (
                                            <span key={r.compKey} className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium">
                                                <button onClick={() => reopenRecord(r)} className="hover:text-primary transition-colors cursor-pointer" title="Reabrir competência">
                                                    {r.competenceShort} · {formatCurrency(r.totalPagar)}
                                                </button>
                                                <button onClick={() => delComp(r.compKey)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" title="Remover competência">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Workspace: editor à esquerda, resumo ao vivo (fixo) à direita */}
                    <div className="grid gap-5 items-start lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="min-w-0 sete-editor">
                            <EditorPanel
                                clientData={clientData}
                                setClientData={setClientData}
                                taxes={taxes}
                                setTaxes={setTaxes}
                                validationErrors={validationErrors}
                                setValidationErrors={setValidationErrors}
                            />
                        </div>
                        <LiveSummary clientData={clientData} taxes={taxes} />
                    </div>
                </TabsContent>

                {/* ===================== VISUALIZAR ===================== */}
                <TabsContent value="preview">
                    <div id="sete-report">
                        <ReportPreview clientData={clientData} taxes={taxes} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

/* ===== Estilos do gerador (portados de template-sete/src/index.css) =====
   Injetados via <style> para não esbarrar nas regras de CSS global do Next. */
const SETE_STYLES = `
@font-face{font-family:'Wildest';src:url('/fonts/Wildest.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap;}

/* Cores de marca alinhadas ao app: navy do sistema (#001D3D) e dourado (#D4A657) */
.text-navy{color:#001D3D;} .bg-navy{background-color:#001D3D;} .border-navy{border-color:#001D3D;}
.dark .text-navy{color:#9bc1ee;}
.text-gold{color:#D4A657;} .bg-gold{background-color:#D4A657;}
.hover\\:bg-blue-900:hover{background-color:#0a3160;}

/* Neutraliza os acentos azuis do editor para o tom do sistema (escopo .sete-editor) */
.sete-editor .bg-blue-50{background-color:color-mix(in srgb, var(--primary) 6%, var(--card)) !important;}
.sete-editor .border-blue-200{border-color:color-mix(in srgb, var(--primary) 22%, var(--border)) !important;}
.sete-editor .text-blue-800,.sete-editor .text-blue-700{color:var(--foreground) !important;}
.sete-editor .text-blue-600{color:var(--primary) !important;}
.sete-editor .accent-blue-700{accent-color:var(--primary) !important;}
.sete-editor .focus\\:border-blue-500:focus{border-color:var(--ring) !important;}

@media screen {
    .report-preview { max-width: 850px; margin: 0 auto; background: #e8ebf1; box-shadow: 0 4px 24px -4px rgba(0, 29, 61, 0.16), 0 0 0 1px rgba(0, 29, 61, 0.05); border-radius: 12px; padding: 28px 30px; display: flex; flex-direction: column; }
    .print-only { display: none !important; }
}

@media print {
    @page { size: A4 portrait; margin: 0; }
    *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    /* Isola o relatório do restante do app (sidebar, header etc.) */
    body * { visibility: hidden !important; }
    #sete-report, #sete-report * { visibility: visible !important; }
    #sete-report { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
    html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #e8ebf1 !important; font-size: 11px !important; line-height: 1.45 !important; overflow: visible !important; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .print-wrapper { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
    .report-preview { box-sizing: border-box !important; width: auto !important; max-width: none !important; height: auto !important; padding: 11mm 11mm 0 11mm !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; background: #e8ebf1 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; display: block !important; overflow: visible !important; }
    .report-preview-body { display: block !important; min-height: 266mm !important; }
    .report-preview + .report-preview { page-break-before: always !important; }
    .report-preview:last-of-type { padding-bottom: 0 !important; }
    .report-preview .mb-8 { margin-bottom: 0 !important; }
    .report-preview .page-footer { margin-top: 0 !important; padding-top: 8px !important; }
    .report-preview .bg-white.rounded-2xl { padding: 11px 13px !important; }
    .report-preview .grid > .rounded-2xl { padding: 12px 13px !important; }
    .report-preview .mb-4 { margin-bottom: 8px !important; }
    .report-preview tbody td, .report-preview tfoot td, .report-preview thead th { padding-top: 4px !important; padding-bottom: 4px !important; }
    .evo-chart { height: 80px !important; }
    .report-preview .cal-day { min-height: 44px !important; }
    .report-preview .page-header-inner { padding: 13px 20px !important; }
    table { break-inside: auto !important; }
    tr, thead, tfoot { break-inside: avoid !important; page-break-inside: avoid !important; }
    .sec-ttl { break-after: avoid !important; page-break-after: avoid !important; }
    .print-grid-2 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
    .shadow-xl, .shadow-2xl, .shadow-lg, .shadow-md, .shadow-sm { box-shadow: none !important; }
    .avoid-break { break-inside: avoid !important; page-break-inside: avoid !important; }
    a[href]:after { content: none !important; }
    .print-navy { color: #1e3a8a !important; }
    .print-white { color: white !important; }
    .print-gold { color: #C5A059 !important; }
    .print-bg-navy { background-color: #1e3a8a !important; }
    .print-fator-r-box { background-color: #f8fafc !important; border: 1px solid #cbd5e1 !important; }
    .print-bg-emerald { background-color: #ecfdf5 !important; border-color: #a7f3d0 !important; }
    .print-bg-red { background-color: #fef2f2 !important; border-color: #fca5a5 !important; }
}

.field-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; transition: all 0.2s; outline: none; background: white; color: #0f172a; }
.field-input:focus { border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1); }
.field-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
.tab-btn { padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
.tab-btn.active { background: #1e3a8a; color: white; }
.tab-btn:not(.active) { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
.tab-btn:not(.active):hover { background: #e2e8f0; color: #334155; }

@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toastIn { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes toastOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-20px) scale(0.95); } }
@keyframes spin { to { transform: rotate(360deg); } }

.animate-fade-in-up { animation: fadeInUp 0.4s ease-out forwards; }
.animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
.animate-slide-down { animation: slideDown 0.3s ease-out forwards; }

.toast { position: fixed; top: 80px; right: 20px; z-index: 9999; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); display: flex; align-items: center; gap: 10px; animation: toastIn 0.3s ease-out; }
.toast.hiding { animation: toastOut 0.3s ease-out forwards; }
.toast-success { background: linear-gradient(135deg, #ecfdf5, #d1fae5); color: #065f46; border: 1px solid #a7f3d0; }
.toast-warning { background: linear-gradient(135deg, #fffbeb, #fef3c7); color: #92400e; border: 1px solid #fcd34d; }
.toast-error { background: linear-gradient(135deg, #fef2f2, #fee2e2); color: #991b1b; border: 1px solid #fca5a5; }

.field-input.field-error { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important; }
.field-error-msg { color: #ef4444; font-size: 10px; font-weight: 600; margin-top: 2px; }

.tab-content { animation: fadeIn 0.25s ease-out; }
.tax-row { transition: all 0.2s ease; }
.tax-row:hover { background: #f8fafc !important; transform: translateX(2px); }

.pdf-loading-overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(4px); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; animation: fadeIn 0.2s ease-out; }
.pdf-loading-spinner { width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #1e3a8a; border-radius: 50%; animation: spin 0.8s linear infinite; }
.card-hover { transition: all 0.3s ease; }
.card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1); }
`;

export default App;
