# Arquitetura

Documentação técnica pra desenvolvedor — stack, estrutura de pastas,
fluxo de dados.

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15.2.4 |
| Lib UI | React | 19 |
| Linguagem | TypeScript | 5 |
| Estilo | Tailwind CSS | 3.4 |
| Componentes | shadcn/ui (Radix UI) | latest |
| Backend | Supabase (Postgres) | hosted |
| Forms | react-hook-form + zod | 7 + 3 |
| Charts | Recharts | 2 |
| Toasts | sonner | latest |
| Date utils | nativo + funções custom em `lib/date-utils.ts` | — |
| Geo/Clima | Open-Meteo, ipapi.co, BigDataCloud (sem chave) | — |

**Sem auth ativa** — anon key do Supabase basta. Quando ativar Auth,
precisa configurar RLS em todas as tabelas.

## Estrutura de pastas

```
app/                       Páginas (Next.js App Router)
├── page.tsx                 Dashboard principal
├── layout.tsx               Root layout (DataProvider, PeriodProvider)
├── clientes/page.tsx        Empresas
├── obrigacoes/page.tsx      Obrigações Acessórias (delega pro <ObligationList/>)
├── impostos/page.tsx        Guias de Imposto
├── parcelamentos/page.tsx   Parcelamentos
├── calendario/page.tsx      Calendário fiscal
├── relatorios/page.tsx      Relatórios
├── templates/page.tsx       Templates customizáveis
└── api/cnpj/[cnpj]/route.ts API route — proxy pra BrasilAPI

components/                Componentes compartilhados
├── ui/                       shadcn/ui (button, dialog, select, etc)
├── filter-panel.tsx         FilterPill, FilterBar (filtros estilo Linear)
├── bulk-actions-bar.tsx     Barra de ações em lote
├── dashboard-stats.tsx      Cards de KPIs
├── productivity-stats.tsx   4 cards de produtividade
├── regime-distribution-chart.tsx  Gráficos da seção Distribuição
├── upcoming-obligations.tsx Próximas obrigações no dashboard
├── upcoming-taxes.tsx       Próximas guias no dashboard
├── client-overview.tsx      "Visão por cliente" no dashboard
├── recent-activity.tsx      Feed de atividade recente
├── weather-greeting.tsx     Widget de clima + saudação
├── fiscal-calendar.tsx      Calendário grande (/calendario)
├── reports-panel.tsx        Painel de relatórios
├── period-switcher.tsx      Navegação de mês no topo
├── top-bar.tsx              Header com nav + period switcher
├── navigation.tsx           Menu de navegação
├── global-search.tsx        Cmd+K busca global
├── confirm-dialog.tsx       Dialog reutilizável de confirmação
├── export-dialog.tsx        Diálogo de exportação Excel/CSV
├── export-button.tsx        Botão "Exportar" reutilizável
└── template-apply-dialog.tsx Diálogo de aplicar template em empresas

contexts/
├── data-context.tsx         Carrega clients/taxes/obligations/installments do Supabase + memoiza
└── period-context.tsx       Período selecionado (mês ou "all") + isInPeriod()

features/                  Lógica por domínio
├── clients/
│   ├── components/client-form.tsx, client-list.tsx
│   ├── schemas.ts             zod schemas
│   └── services.ts            map TS↔Supabase + saveClient/deleteClient
├── obligations/
│   ├── components/obligation-form.tsx, obligation-list.tsx, obligation-details.tsx
│   ├── schemas.ts
│   └── services.ts
├── taxes/                   mesma estrutura
├── installments/            mesma estrutura
└── templates/
    ├── components/template-package-form.tsx, quick-add-items-dialog.tsx, bulk-add-item-to-templates-dialog.tsx
    └── services.ts          getCustomTemplatesAsync, saveCustomTemplateAsync, deleteCustomTemplateAsync

hooks/
├── use-selected-period.ts    Re-export de PeriodProvider
├── use-url-state.ts          Estado sincronizado com query string
└── use-toast.ts              Wrapper do sonner

lib/
├── types.tsx                 Types principais (Client, Tax, Obligation, Installment, etc)
├── date-utils.ts             buildSafeDate, isHoliday, getHolidayName, calculateDueDateFromCompetency, etc
├── obligation-status.ts      effectiveStatus(), isCriticalNow() — calcula "overdue" dinamicamente
├── obligation-templates.ts   ObligationTemplate type, templates padrão (PRESUMIDO_*, SIMPLES_*, etc), getCustomTemplates, seedDefaultTemplates
├── template-applier.ts       applyTemplateToClient — gera obrigações pra cada competência
├── template-item-catalog.ts  Catálogo de itens comuns pra "Adicionar vários"
├── recurrence-engine.ts      Geração automática de recorrências mensais
├── auto-recurrence.ts        Hook do app — checkAndGenerateRecurrences
├── dashboard-utils.ts        getObligationsWithDetails (enriquece obligation com client+tax+calculatedDueDate)
├── weather.ts                Open-Meteo, ipapi.co, BigDataCloud, getGreetingMeta
├── seed-demo.ts              Botão "Carregar 30 empresas" (templates page)
├── cnpj-service.ts           Busca CNPJ via /api/cnpj/[cnpj]
├── export-utils.ts           Geração de Excel via xlsx
├── metrics.ts                Métricas avançadas (dead code — não importado)
└── supabase/
    ├── core.ts                createClient, getSupabaseClient, hasSupabaseConfig, local store fallback
    └── database.ts            getClients, getTaxes, getObligations, getInstallments, lockedPeriods CRUD

scripts/                   Migrations SQL — rodar manualmente no Supabase
├── 001_create_tables.sql      schema inicial
├── 002_*.sql … 006_*.sql      migrations incrementais (campos novos, tabelas extras)
└── setup_complete.sql         consolidado pra setup do zero
```

## Fluxo de dados — overview

```
Supabase (Postgres) → DataProvider (Context) → Páginas/Componentes
                          ↑
        useData() expõe: clients, taxes, obligations,
        obligationsWithDetails (memoizado), installments, etc.

PeriodProvider (Context) → todas as páginas
                              ↑
        useSelectedPeriod() expõe: period, isInPeriod(),
        periodLabel, isFiltering, etc.
```

### Carregamento inicial

1. `app/layout.tsx` envolve tudo em `<DataProvider>` + `<PeriodProvider>`.
2. `DataProvider.useEffect` no mount → `refreshData()`:
   - Roda `Promise.all` buscando clients, taxes, obligations, installments,
     lockedPeriods e templates do Supabase.
   - Marca `isLoading: false` quando tudo retorna.
3. `obligationsWithDetails` é memoizado dentro do provider — calcula
   uma vez e todas as páginas consomem, em vez de cada uma chamar
   `getObligationsWithDetails` e fazer O(n*m) repetido.

### Save de uma obrigação

1. Form em `features/obligations/components/obligation-form.tsx` valida com zod.
2. `onSubmit` constrói `Obligation` e chama `saveObligation(obl)` em
   `features/obligations/services.ts`.
3. Service chama `mapObligationToDb(obl)` (snake_case keys) e
   `supabase.from("obligations").upsert(...)`.
4. Após save, caller chama `refreshData()` do `DataProvider` →
   re-fetch geral, todas as páginas que usam `useData()` re-renderizam.

### Aplicar Template em Empresas

1. Em `/clientes`, user marca empresas + clica "Aplicar Template".
2. `<TemplateApplyDialog>` mostra o template + lista de itens + range
   de competência.
3. User confirma → `applyTemplateToClient(client, items, range)` em
   `lib/template-applier.ts`:
   - `generateCompetencies(range, recurrence)` gera array de "YYYY-MM"
     respeitando o ciclo (mensal/trim/anual).
   - Pra cada competência × item: cria `Obligation` ou `Tax` com
     `competencyMonth` setado.
   - Dedupe por `(name + competencyMonth)`.
   - `Promise.all` salva todos.
4. `onUpdate()` chama `refreshData()`.

### Cálculo de vencimento

```
calculateDueDateFromCompetency(competency, dueDay, weekendRule, dueMonth?)
```

- **Default** (sem `dueMonth`): vence dia `dueDay` do mês SEGUINTE à competência.
  Ex: competência "2026-01" + dueDay 20 → 20/02/2026.
- **Anual com `dueMonth`** (DEFIS, DASN-SIMEI): vence
  `(year(competência) + 1, dueMonth, dueDay)`. Ex: competência "2025-01"
  + dueDay 31 + dueMonth 3 → 31/03/2026.
- Resultado passa por `adjustForWeekend(date, weekendRule)`:
  - `anticipate` — antecipa pra dia útil anterior se cair em feriado/sábado/domingo
  - `postpone` — posterga pra próximo dia útil
  - `keep` — mantém

`buildSafeDate(year, month, day)` normaliza dia inexistente
(ex: 31 em fevereiro → 28/29).

## Persistência

### Tabelas Supabase (após todas as migrations)

| Tabela | Uso |
|---|---|
| `clients` | Empresas |
| `taxes` | Guias de Imposto |
| `obligations` | Obrigações Acessórias |
| `installments` | Parcelamentos |
| `history` | Auditoria de mudanças (raramente populado hoje) |
| `custom_obligation_templates` | Templates customizados pelo usuário |
| `deleted_default_templates` | Lista negra de templates padrão deletados |
| `locked_periods` | Períodos travados (não usado na UI ainda) |

### LocalStorage

- `fiscal_custom_templates` — cache local de templates (sync com Supabase)
- `fiscal_templates_seeded_names` — set de nomes já criados pelo seed
- `fiscal_templates_deleted_defaults` — lista negra local
- `fiscal_templates_mei_real_cleanup_v2` — flag one-shot do cleanup
- `col-width-{key}` — larguras de colunas (ResizableTableHead)

## Ciclo de vida de uma obrigação

```
[user cadastra empresa]
       ↓
[user aplica Template ou cria obrigação manual]
       ↓
[Obligation criada com status="pending"]
       ↓
       ├─ data passou + status ainda pending → effectiveStatus() retorna "overdue"
       │  (mas o status no DB continua "pending" — só recalcula em runtime)
       │
       └─ user clica "Iniciar" → status="in_progress"
              ↓
          user clica "Concluir" → status="completed", completedAt=now
```

Nota: status `"overdue"` raramente é gravado no banco — quase sempre
é calculado em runtime via `lib/obligation-status.ts:effectiveStatus()`.
O chart e as tabs usam essa função pra refletir realidade.

## Filtro de período (PeriodSwitcher)

`contexts/period-context.tsx` — estado React puro (não persistido em URL,
sempre começa no mês corrente em cada (re)load).

`isInPeriod(date)`:
- Se `period === "all"` → sempre `true`
- Senão → compara `YYYY-MM` da data com o `YYYY-MM` selecionado

Páginas que filtram por período:
- ✅ Dashboard (obligations + filteredTaxes + critical/thisWeek installments)
- ✅ /obrigacoes
- ✅ /impostos
- ✅ /parcelamentos (statusCounts também)
- ✅ /calendario (período do calendário acompanha o switcher)
- ❌ /relatorios (tem filtro próprio interno, não usa o global — design intencional)
- ❌ /templates (templates são globais, sem período)

## Padrões de código

- **Componentes**: PascalCase, named export
- **Hooks**: camelCase com prefixo `use`
- **Helpers**: camelCase, em `lib/`
- **Types**: PascalCase, em `lib/types.tsx`
- **Server-only / Client-only**: `"use client"` no topo do arquivo quando
  precisa de hooks/eventos
- **shadcn/ui**: importar de `@/components/ui/*`
- **Toasts**: `import { toast } from "sonner"` — `toast.success()`, `toast.error()`, `toast.info()`
- **Forms**: `react-hook-form` + `zod` + `@hookform/resolvers/zod`
- **Tabelas resizáveis**: `<ResizableTableHead defaultWidth={X} storageKey="page-col">`

## Performance

- ✅ `obligationsWithDetails` memoizado no DataProvider (evita O(n*m)
  repetido em 5+ páginas)
- ✅ `filteredObligations` + `sortedObligations` memoizados em
  `obligation-list.tsx`
- ✅ Filtros do dashboard (`criticalAlerts`, `thisWeekObligations`, etc)
  envoltos em `useMemo`
- ✅ Charts no dashboard: gradient SVG cacheados via `<defs>`,
  `isAnimationActive={false}` no Pie pra evitar flicker
- ✅ Auto-refresh ao voltar pra aba (debounce de 10s) — `data-context.tsx`
- ⚠️ Falta lazy-load do Recharts (bundle de /impostos é 534kB).
  Considerar `dynamic(() => import('...'), { ssr: false })`.

## Testes

Não há suite de testes formal hoje. Se for adicionar:
- Vitest + React Testing Library pros componentes
- Foco nos cálculos de data (`lib/date-utils.ts`) e nas regras
  fiscais (`lib/template-applier.ts:generateCompetencies`)
