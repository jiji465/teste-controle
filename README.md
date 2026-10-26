# Controle Fiscal

Sistema web pra contador gerenciar obrigações fiscais, impostos e parcelamentos
das empresas atendidas. Foco no fluxo de trabalho de um escritório de
contabilidade brasileiro.

> 🌐 Live: https://teste-controle-alpha.vercel.app/

## O que faz

- **Empresas** — cadastro de clientes (CNPJ, regime, atividade, contato).
- **Guias de Imposto** — DAS, IRPJ, ICMS, ISS, etc, por competência.
- **Obrigações Acessórias** — declarações ao Fisco (DCTFWeb, SPED, DEFIS, ECD…).
- **Parcelamentos** — REFIS e parcelamentos de débitos.
- **Serviços avulsos** — NF-e, consultorias e outras tarefas com data única.
- **Fechamento de competência** — trava o mês no banco (ninguém altera itens
  de um mês fechado até ele ser reaberto).
- **Calendário Fiscal** — visão mensal de vencimentos, com ajuste automático
  por feriado nacional, feriados locais (Configurações) e fim de semana.
- **Templates** — pacotes de obrigações por regime+atividade que aplicam
  em várias empresas de uma vez.
- **Dashboard** — saúde do mês, próximos vencimentos, distribuição por
  regime/estado/atividade, clima atual + saudação dinâmica.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui** (componentes Radix)
- **Supabase** (Postgres + Auth + RLS; papel `viewer` somente leitura)
- **ExcelJS / jsPDF** pra exportações (carregados sob demanda)
- **Vitest** pros testes de regras (datas, recorrência, CNPJ…)
- **Recharts** pra gráficos
- **Open-Meteo + ipapi.co + BigDataCloud** pra clima/localização (gratuitas, sem chave)

## Documentação

| Arquivo | Pra quem | Conteúdo |
|---|---|---|
| 📘 [docs/USUARIO.md](docs/USUARIO.md) | Contador / usuário final | Como usar cada tela, atalhos, dicas |
| 🏗️ [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Desenvolvedor | Stack, estrutura de pastas, fluxo de dados |
| 📖 [docs/REGRAS-FISCAIS.md](docs/REGRAS-FISCAIS.md) | Quem mexe na lógica | Regras brasileiras codificadas (vencimentos, feriados, regimes) |
| 🛠️ [docs/MANUTENCAO.md](docs/MANUTENCAO.md) | Quem cuida da operação | Supabase, Vercel, backups, troubleshooting |

## Começar a desenvolver

```bash
# 1. Clonar e instalar
git clone <repo>
cd teste-controle
npm install

# 2. Variáveis de ambiente — crie .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# 3. Rodar local
npm run dev
# → http://localhost:3000

# Qualidade
npm run typecheck && npm run lint && npm test
```

Pra setup completo do Supabase (criar tabelas, rodar migrations), veja
[docs/MANUTENCAO.md](docs/MANUTENCAO.md#setup-inicial-do-supabase).

> ⚠️ **Ordem de instalação do banco (validada por `npm test`)** — no SQL
> Editor do Supabase, um arquivo por vez: `setup_complete` → `RUN_ME_ON_SUPABASE`
> → `004` … `015` → `016` → `017` → `018` → `019` → `020` → `021` → `022` →
> **`023_papeis_auditoria.sql`** (papéis deny-by-default: conta sem papel não
> vê nada; viewer só Dashboard/Empresas; histórico só leitura e com autor do
> servidor). Banco antigo: `001` → `002` → `003` → mesma sequência a partir do
> `004`. Todos são idempotentes. Crie sua conta **antes** do 023 e siga o
> [checklist do painel](docs/MANUTENCAO.md#checklist-do-painel-do-supabase-segurança)
> (desligar cadastro aberto e login anônimo, proteção de senha vazada, MFA).
> Banco já em produção: [passo a passo do 023](docs/MANUTENCAO.md#aplicar-o-023-num-banco-que-já-está-em-produção).

## Estrutura geral

```
.
├── app/                  Páginas (App Router do Next.js)
│   ├── page.tsx           → Dashboard
│   ├── clientes/          → Empresas
│   ├── obrigacoes/        → Obrigações Acessórias
│   ├── impostos/          → Guias de Imposto
│   ├── parcelamentos/
│   ├── calendario/
│   ├── relatorios/
│   ├── templates/
│   ├── servicos/
│   ├── configuracoes/     → Feriados locais, conta
│   └── api/cnpj/[cnpj]/   → API route — lookup CNPJ via BrasilAPI
├── components/           Componentes compartilhados (UI + dashboard)
├── contexts/             React Context (data, period)
├── features/             Lógica por feature (clients, obligations, taxes, installments, services, periods, settings, history…)
├── hooks/                Hooks customizados
├── lib/                  Utils — datas, types, Supabase, regras fiscais
├── scripts/              Migrations SQL (rodar manualmente no Supabase)
└── docs/                 Esta documentação
```

## Status & roadmap

✅ **Funcionando:**
- CRUD completo de empresas, impostos, obrigações, parcelamentos
- Templates customizáveis com aplicação em massa
- Filtros pill + ordenação + bulk actions em todas as tabelas
- Calendário fiscal com feriados nacionais nomeados
- Dashboard rico com gráficos, clima e saudação dinâmica
- Multi-device sync via Supabase
- Login multi-usuário (Auth + RLS) com papel somente leitura
- Fechamento de competência no banco
- Feriados estaduais/municipais configuráveis
- Histórico (auditoria) com autor real em cada item
- CNPJ alfanumérico (IN RFB 2.229/2024) e CPF

🟡 **Em consideração:**
- Notificações de vencimento por e-mail (Cron + Resend)
- Sync com Google Calendar
- DCTFWeb / DEFIS / DASN-SIMEI com vencimentos anuais fixos ✅ implementado

❌ **Fora de escopo (por enquanto):**
- Emissão de NFe/NFSe
- Conciliação bancária / Open Banking
- Integração com e-CAC (requer certificado A1/A3 + scraping)

## Licença

Privado — uso interno.
