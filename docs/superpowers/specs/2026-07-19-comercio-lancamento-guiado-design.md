# Comércio: lançamento guiado — desenho

**Data:** 2026-07-19 · **Contexto:** apuração de comércio (Lucro Presumido) no Relatório Executivo.

## Problema
A seção "Receita & ICMS — Comércio" (`features/apuracao/sete/SeteApuracao.jsx`) tem ~13 campos + quadros de estimativa de ICMS (débito/crédito, alíquota interna/entrada, saldo credor, base dupla). Na prática do escritório, o ICMS **sempre vem do SPED** e DIFAL/Antecipação/FUMACOP **já vêm com valor pronto** — a maquinaria de estimativa não é usada e só pesa. Validado por agente-contador (facilidade 8/10, completude 5/10) que apontou furos: falta ICMS-ST próprio, confusão monofásico≠ST, FUMACOP/ICMS-ST ausentes do default, data travada.

## Princípio
A ferramenta **calcula** só o que o contador não pega pronto (PIS/COFINS cumulativo, IRPJ/CSLL presumido, encargos de folha) e **captura** o que já vem apurado (ICMS SPED, ICMS-ST, DIFAL, Antecipação, FUMACOP). O usuário pensa por **CST**.

## Nova seção (v3)
**Sempre visível:**
1. Faturamento (saídas) do mês — base de PIS/COFINS/IRPJ/CSLL.
2. ICMS próprio do mês (SPED) — valor final (contempla CST ICMS 40/20/60).
3. Receita SEM PIS/COFINS — soma dos CST **04/05/06/09** (monofásico, alíq. zero, ST-PIS, suspensão); abate só a base de PIS/COFINS.

**Interruptores** (on/off; valor digitado por mês, começa vazio):
- É substituto (recolhe ICMS-ST nas saídas)? → ICMS-ST a recolher (R$) — guia própria (venc. dia 10).
- Antecipação / ICMS-ST na entrada? → valor (venc. dia 20).
- DIFAL? → valor (venc. dia 10).
- FUMACOP? → valor (venc. dia 20).

Folha e pró-labore continuam na seção "Folha, encargos & sócios". Vencimentos automáticos por tipo, **mas editáveis** (trava `dueDateManual` para não sobrescrever a data ajustada).

## Motor (`engine.js`)
- `DEFAULT_TAXES_LP_COMERCIO`: núcleo sempre-presente (PIS, COFINS, ICMS, IRPJ, Adicional, CSLL, CPP, RAT, Terceiros, FGTS). ICMS-ST/DIFAL/Antecipação/FUMACOP entram/saem por interruptor (via `recalcular`).
- `autoFillTaxes` comércio: ICMS = `icmsApurado` (SPED); ICMS (ST) = `icmsStValor`; DIFAL = `difalValor`; Antecipação = `antecipacaoValor`; FUMACOP = `fumacopValor` — todos **valor direto**, sem cálculo.
- Exclusão de PIS/COFINS passa a se referir a **receita sem PIS/COFINS (CST 04/05/06/09)** (campo `receitaMonofasica` reaproveitado; rótulo corrigido, sem "/ST").
- Remover `calcComercioLP` e toda a estimativa débito/crédito. Adicionar lock `dueDateManual`.

## Campos removidos (estimativa)
entradasCompras, aliqIcmsSaida, aliqIcmsEntrada, icmsDebitoTotal, icmsCreditoTotal, saldoCredorICMS, saidasST, aliqInterestadual, baseDifal, baseAntecipacao, baseFumacop.

## Verificação
Testes de engine (comércio: ICMS SPED direto, ICMS-ST/DIFAL/Antecipação/FUMACOP por valor, PIS/COFINS excluindo CST 04/05/06/09). Typecheck, build, e apuração live do cenário do agente (substituto com ICMS-ST + DIFAL + Antecipação + FUMACOP).
