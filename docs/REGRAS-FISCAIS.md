# Regras Fiscais Brasileiras

Documento que descreve as regras tributárias brasileiras codificadas
no sistema. Atualize aqui quando a legislação mudar.

> ⚠️ **Aviso legal**: este sistema é uma ferramenta auxiliar de controle.
> **Não substitui** consulta a um contador habilitado e à legislação
> vigente. Datas e regras podem mudar — sempre confira no calendário
> oficial da Receita Federal e Receita Estadual/Municipal correspondente.

## Feriados nacionais

Codificados em [`lib/date-utils.ts`](../lib/date-utils.ts).

### Fixos (9)

| Data | Feriado | Base legal |
|---|---|---|
| 1º jan | Confraternização Universal | Lei 662/49 |
| 21 abr | Tiradentes | Lei 662/49 |
| 1º mai | Dia do Trabalho | Lei 662/49 |
| 7 set | Independência do Brasil | Lei 662/49 |
| 12 out | Nossa Senhora Aparecida | Lei 6.802/80 |
| 2 nov | Finados | Lei 662/49 |
| 15 nov | Proclamação da República | Lei 662/49 |
| **20 nov** | **Consciência Negra** | Lei 14.759/24 (federal desde 2024) |
| 25 dez | Natal | Lei 662/49 |

### Móveis (4) — derivados da Páscoa

Calculados via algoritmo Meeus/Jones/Butcher (preciso pra qualquer ano)
em `calculateEaster()`.

| Feriado | Offset da Páscoa |
|---|---|
| Segunda-feira de Carnaval | -48 dias |
| Terça-feira de Carnaval | -47 dias |
| Sexta-feira Santa | -2 dias |
| Corpus Christi | +60 dias |

### Não incluídos (intencional)

- ❌ **Feriados estaduais** (ex: 9 jul Revolução Constitucionalista em SP)
- ❌ **Feriados municipais** (aniversários da cidade, padroeiros)
- ❌ **Pontos facultativos** que não são feriado oficial (ex: Quarta de Cinzas)

> Se sua cidade tem feriado próprio, atualmente a única forma é
> editar manualmente a data de cada vencimento afetado. Roadmap futuro:
> permitir cadastro de feriados extras por usuário.

## Ajuste de vencimento por feriado/fim de semana

Função: `adjustForWeekend(date, rule)`.

| `weekendRule` | Comportamento |
|---|---|
| `anticipate` | Antecipa pro último dia útil anterior |
| `postpone` | Posterga pro próximo dia útil |
| `keep` | Mantém na data exata |

**Convenção do sistema** (definida nos templates):
- Federais → `anticipate` (Receita Federal antecipa pra dia útil anterior)
- Estaduais / Municipais → `postpone` (geralmente postergam)

Quando a data é ajustada, o sistema mostra na UI:
> 🎉 ← Feriado: Tiradentes (vencimento original 21/04/2026)

## Regimes tributários

Mapeados em `lib/types.tsx:TaxRegime`:

| Código | Label | Características relevantes |
|---|---|---|
| `simples_nacional` | Simples Nacional | DAS único mensal + DEFIS anual |
| `lucro_presumido` | Lucro Presumido | IRPJ/CSLL trimestrais OU mensais antecipados, PIS/COFINS cumulativos |
| `lucro_real` | Lucro Real | IRPJ/CSLL mensais (estimativa) ou trimestrais, PIS/COFINS não-cumulativos |
| `mei` | MEI | DAS-MEI mensal + DASN-SIMEI anual |
| `imune_isento` | Imune / Isento | Igrejas, partidos, ONGs |

## Atividades empresariais

`BusinessActivity` em `lib/obligation-templates.ts`:

- `servicos` — Prestação de Serviços (gera ISS)
- `comercio` — Comércio / Varejo (gera ICMS)
- `industria` — Indústria / Fabricação (gera ICMS + IPI)
- `misto` — Combina serviços + comércio

## Vencimentos dos principais tributos

Codificado em [`lib/obligation-templates.ts`](../lib/obligation-templates.ts)
e [`lib/template-item-catalog.ts`](../lib/template-item-catalog.ts).

### Federais — mensais

| Tributo | Dia | Esfera | Regra fim de semana |
|---|---|---|---|
| INSS / GPS | 20 | federal | anticipate |
| DAS Simples Nacional | 20 | federal | anticipate |
| PGDAS-D | 20 | federal | anticipate |
| DAS-MEI | 20 | federal | anticipate |
| **PIS** | 25 | federal | anticipate |
| **COFINS** | 25 | federal | anticipate |
| EFD-Contribuições | 10 | federal | anticipate |
| **IPI** | 25 | federal | anticipate |
| **IRPJ Mensal** (Lucro Real Estimativa ou Lucro Presumido com antecipação) | **31** (último dia útil) | federal | anticipate |
| **CSLL Mensal** | **31** (último dia útil) | federal | anticipate |
| **DCTFWeb** | **31** (último dia útil) | federal | anticipate |

### Federais — trimestrais

| Tributo | Vencimento | Esfera |
|---|---|---|
| **IRPJ Trimestral** (Lucro Presumido / Lucro Real Trimestral) | Último dia útil do mês seguinte ao trimestre (Lei 9.430/96 art. 5º) | federal |
| **CSLL Trimestral** | mesma regra | federal |

> 📌 Implementação: competência alinhada pro último mês do trimestre
> (mar/jun/set/dez) + dueDay 31. Resultado:
> - 1T (jan-mar) vence 30/04
> - 2T (abr-jun) vence 31/07
> - 3T (jul-set) vence 31/10 (sex)
> - 4T (out-dez) vence 31/01 do ano seguinte (qua)

### Federais — anuais com data fixa

| Tributo | Vencimento | dueMonth | dueDay |
|---|---|---|---|
| **DEFIS** | 31 de março do ano seguinte ao exercício | 3 | 31 |
| **DASN-SIMEI** | 31 de maio do ano seguinte ao exercício | 5 | 31 |

> 📌 Implementação: campo `dueMonth` no template/obrigação. Quando
> `recurrence === 'annual'` e `dueMonth` preenchido, calcula
> `(year(competência) + 1, dueMonth, dueDay)`.

### Estaduais

| Tributo | Dia | Regra fim de semana |
|---|---|---|
| ICMS | 9 (varia por estado) | postpone |
| ICMS-ST | 9 (varia) | postpone |
| SPED Fiscal (EFD ICMS/IPI) | 15 (varia por estado) | postpone |

> ⚠️ ICMS **varia muito** por estado (ex: SP usa último dia útil, GO usa
> dia 9, MG usa dia 25). Os defaults são chute razoável — **confira o
> calendário do seu estado** e ajuste por empresa.

### Municipais

| Tributo | Dia | Regra fim de semana |
|---|---|---|
| ISS | 10 (varia por município) | postpone |
| ISS Retido | 10 (varia) | postpone |

> ⚠️ ISS varia por município. Dia 10 é comum em SP/RJ/Minas, mas pode
> ser dia 5, 15, 20… Confira na prefeitura.

### Não incluídos no sistema (intencional)

- **FGTS** — controle pelo DP (Departamento Pessoal), não pelo Fiscal
- **RAIS** — idem (DP)
- **DIRF** — idem (DP)
- **ECD / ECF** — anuais, removidas dos templates a pedido (pode ser
  adicionada manualmente por empresa)
- **NF-e / NFS-e** — emissão fora do escopo do sistema

## Cálculo de competência

A "competência" representa o **período fiscal de apuração** (formato
`YYYY-MM`).

**Regra padrão:** vencimento = mês seguinte ao da competência.

| Recorrência | Como `applyTemplateToClient` gera competências |
|---|---|
| `monthly` | Uma por mês (ex: jan, fev, mar, …) |
| `bimonthly` | A cada 2 meses (jan, mar, mai, …) |
| `quarterly` | **Alinhado ao último mês do trimestre fiscal** (mar, jun, set, dez) |
| `semiannual` | A cada 6 meses |
| `annual` | Uma por ano (mês inicial do range) |
| `custom` | Custom step em meses |

## Status e cálculo de "atrasado"

[`lib/obligation-status.ts`](../lib/obligation-status.ts):

```ts
effectiveStatus(item):
  se item.status !== "pending" → retorna item.status
  se data(item) < hoje (dia local) → "overdue"
  senão → "pending"
```

Usado em:
- ✅ Tab "Atrasadas" em /obrigacoes e /impostos
- ✅ Card "Saúde das Obrigações" no dashboard
- ❌ Dashboard "Alertas Críticos" usa `<=` (inclui hoje) — semântica diferente

## Como adicionar um tributo novo

Exemplo: adicionar **GIA-ICMS-SP** (vence dia 16 do mês seguinte, estadual).

1. Em `lib/template-item-catalog.ts`, adicionar:
```ts
{ group: "Estaduais", name: "GIA-ICMS-SP", description: "...",
  category: "declaration", scope: "estadual", dueDay: 16,
  frequency: "monthly", recurrence: "monthly",
  weekendRule: "postpone", priority: "high" },
```

2. Se quiser que apareça no template padrão de Lucro Presumido Comércio
   em SP, adicionar em `PRESUMIDO_COMERCIO` no mesmo arquivo de templates.

3. (Opcional) Atualizar este documento.

## Como adicionar um tributo anual com data fixa

Exemplo: **ECD** vence em junho do ano seguinte.

```ts
{ name: "ECD", description: "...",
  category: "sped", scope: "federal", dueDay: 30,
  dueMonth: 6,           // ← chave: junho
  frequency: "annual", recurrence: "annual",
  weekendRule: "anticipate", priority: "high" },
```

O sistema calcula automaticamente: competência "2025-12" + dueMonth 6
→ vence 30/06/2026.

## Como mudar uma regra existente

Por exemplo: a Receita decreta que **DCTFWeb** passa a vencer dia 25
em vez de último dia útil.

1. Buscar todos os usos: `grep -rn "DCTFWeb" lib/`
2. Atualizar `dueDay: 31` → `dueDay: 25` em `obligation-templates.ts` e
   `template-item-catalog.ts`
3. Decidir o que fazer com obrigações **já criadas** com dueDay=31:
   - Opção A: deixar como estão (vencimentos no novo dia só pra novas)
   - Opção B: rodar SQL update no Supabase: `UPDATE obligations SET due_day=25
     WHERE name='DCTFWeb' AND status='pending';`
4. Atualizar este documento + commit explicativo

## Convenções importantes

- **`competencyMonth`** é o **período de apuração**, não o de vencimento.
  Ex: ISS de janeiro/2026 = competência "2026-01", vence "2026-02-10".
- **`dueDay`** é o dia do mês de **vencimento**, não da competência.
- Em obrigações trimestrais, a competência é o **último mês do trimestre**
  (mar, jun, set, dez), não o primeiro.
- Em obrigações anuais com `dueMonth` preenchido, vence no ano **seguinte**
  ao da competência.
- Datas sempre normalizadas pelo timezone **local do usuário** (Brasil
  UTC-3) via `parseLocalDate()` e `toLocalDateString()` em `date-utils.ts`,
  pra evitar bugs de "passou meia-noite UTC mas no Brasil ainda é o
  mesmo dia".

## Referências legais

- Lei 9.430/96 — IRPJ/CSLL Trimestral
- Lei Complementar 123/06 — Simples Nacional + DASN-SIMEI
- Resolução CGSN 140/18 — DEFIS
- Lei 14.759/24 — Consciência Negra como feriado nacional
- Calendário Receita Federal — https://www.gov.br/receitafederal/
