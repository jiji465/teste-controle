# Manutenção e Operação

Guia operacional pra quem cuida do sistema (deploy, backup,
troubleshooting). Misturado de "leigo" e "técnico" — ambos servidos.

## Setup inicial do Supabase

Se você está montando o sistema do zero:

### 1. Criar projeto

1. Acesse [supabase.com](https://supabase.com) → "New Project"
2. Escolhe nome, senha do DB e região (escolha **South America (São Paulo)**)
3. Anota a senha do DB num lugar seguro

### 2. Criar a SUA conta antes de trancar o banco

**Authentication** → **Users** → **Add user** (ou entre pela tela `/login`
do sistema). O script 023 dá o papel `editor` às contas que já existirem
quando ele rodar pela primeira vez — conta criada depois disso nasce **sem
acesso** até alguém definir o papel (ver [Papéis e acesso](#papéis-e-acesso)).

### 3. Rodar os scripts SQL (ordem validada)

No **SQL Editor** → "New query", cole e rode **um arquivo por vez**, nesta
ordem. Todos são idempotentes (pode rodar de novo sem estragar nada):

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `setup_complete.sql` | tabelas, índices, gatilhos básicos |
| 2 | `RUN_ME_ON_SUPABASE.sql` | colunas extras (clientes, impostos, obrigações) |
| 3 | `004` → `015` (na ordem dos números; os dois `005` e os dois `006` em ordem alfabética) | evolução do schema, serviços, apuração |
| 4 | `016_auth_rls_lockdown.sql` | só usuários logados (vira no-op se o 017/023 já rodou) |
| 5 | `017_viewer_role.sql` | papel somente leitura |
| 6 | `018_public_portfolio.sql` | painel público (só agregados) |
| 7 | `019_hardening.sql` | RLS em `services`, índices únicos, histórico com autor |
| 8 | `020_locked_periods.sql` | fechamento de competência no banco |
| 9 | `021_office_holidays.sql` | feriados locais |
| 10 | `022_apuracao_integridade.sql` | Relatório Executivo: trava, versão, revisões |
| 11 | `023_papeis_auditoria.sql` | **papéis deny-by-default**, histórico à prova de adulteração, fechamento auditado, `search_path` fixo |

Banco antigo (que começou pelo `001_create_tables.sql`): `001` → `002` →
`003` → mesma sequência a partir do `004`.

> Essa ordem é testada automaticamente (`npm test` →
> `scripts/__tests__/migrations.test.ts`): instalação nova e banco antigo,
> cada script rodado 2x e a cadeia inteira de novo, sem regressão.

### 4. Pegar as chaves

Em **Settings** → **API**:

- `Project URL` → vai em `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` → 🔒 NUNCA exponha. Não use no frontend.

### 5. Configurar no Vercel

Em **Settings** → **Environment Variables** → adiciona as 2 variáveis
acima. Depois redeploy.

## Setup do Vercel

### Configurações recomendadas

| Setting | Onde | Valor |
|---|---|---|
| Framework | auto-detectado | Next.js |
| Build command | auto | `next build` |
| Install command | auto | `pnpm install` |
| Output directory | auto | `.next` |
| Function Region | Settings → Functions | `gru1` (São Paulo) |
| Notifications | Settings → Notifications | Failed deployments + Function errors |

### Domínio customizado

Se você tem um domínio próprio (ex: `escritorio.com.br`):

1. **Vercel** → Settings → Domains → adiciona o domínio
2. Vercel mostra os DNS que precisa configurar
3. Vai no seu registrador (Registro.br, GoDaddy, etc) e adiciona os DNS
4. Espera 5min a algumas horas pra propagar
5. Vercel detecta e ativa HTTPS automático (Let's Encrypt)

### Auto-deploy

Vercel já faz auto-deploy quando você empurra pra `main` no GitHub.

- Push pra `main` → deploy de produção
- Push pra outra branch → preview deployment (URL temporária)

## Backup

### Backup do Supabase (manual)

**Plano Free**: backups automáticos só dos últimos 7 dias.

Pra backup permanente:

#### Via Dashboard (recomendado)

1. **Supabase Dashboard** → **Database** → **Backups** (pode ser
   "Schema visualizer" também)
2. Procura "Download" ou "Export"
3. Gera um SQL com todos os dados → salva no Google Drive / Dropbox

#### Via CLI (avançado)

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Pegar a URL de conexão em Settings → Database → Connection string
# 4. Dump
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres" > backup-$(date +%Y%m%d).sql
```

### Backup do localStorage (templates antigos)

Antes da migração pro Supabase, alguns dados ficavam só em localStorage.
Hoje é tudo Supabase, mas se quiser backup local extra:

```js
// No DevTools Console do navegador, em /templates:
copy(JSON.stringify(localStorage));
// Cola num arquivo .txt e guarda
```

### Restore

```bash
# Restore do dump SQL
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres" < backup-20260428.sql
```

## Migrations — convenção

Quando precisar mudar o schema:

1. Cria `scripts/00X_descricao_curta.sql` com `IF NOT EXISTS` /
   `ADD COLUMN IF NOT EXISTS` pra ser idempotente
2. Atualiza este documento + comentário no SQL com link pra issue/PR
3. Roda no SQL Editor do Supabase
4. Atualiza o services TS pra mapear o campo novo
5. Documenta na ARQUITETURA.md se for tabela nova

**Não use ferramenta de migration automática** (Prisma, Drizzle migrate, etc)
sem alinhar — hoje as migrations são manuais e idempotentes.

## Troubleshooting

### "O site quebrou em produção"

1. Verifica logs: **Vercel Dashboard** → seu projeto → **Logs**
2. Erros comuns:
   - `Cannot read property 'X' of undefined` → algum campo faltando no
     Supabase. Rodar migration que adiciona ele.
   - `Error: Supabase URL not found` → variável de ambiente não setada
     no Vercel
   - `Module not found` → falta `pnpm install` (Vercel re-roda automaticamente)

### "Edição de template volta pro original"

Verificado e corrigido. Causa antiga:
- Race condition entre localStorage e Supabase
- Fix em `features/templates/services.ts`: `saveCustomTemplateAsync`
  await Supabase ANTES de fechar UI

Se voltar a acontecer:
1. Abre DevTools → Network → procura request `custom_obligation_templates`
2. Verifica se retorna 200. Se 4xx, pode ser auth/RLS.

### "Templates antigos de MEI/Lucro Real reapareceram"

Cleanup é one-shot via flag `MEI_REAL_CLEANUP_FLAG` no localStorage.
Se quiser forçar:

```js
// DevTools Console
localStorage.removeItem('fiscal_templates_mei_real_cleanup_v2')
location.reload()
```

A flag nova é `v2`, não `v1` — se você bumpar pra `v3` no código,
roda mais uma vez pra todo mundo.

### "Vencimento de IRPJ caiu no dia errado"

Verifique:
1. Recurrence é `quarterly`?
2. Competência está em mar/jun/set/dez? (`generateCompetencies` alinha
   automaticamente, mas se a obrigação foi criada manualmente com
   competência jan/abr/jul/out, vai dar errado)
3. dueDay é 31?

Se sim, deveria funcionar. Veja [REGRAS-FISCAIS.md](REGRAS-FISCAIS.md#federais--trimestrais).

### "DEFIS / DASN-SIMEI vence em fevereiro"

Bug antigo: faltava `dueMonth`. Verifique:

```sql
-- No Supabase SQL Editor
SELECT name, due_day, due_month, recurrence, competency_month
FROM obligations WHERE name = 'DEFIS';

-- Se due_month for null, tem que ser 3:
UPDATE obligations SET due_month = 3
WHERE name = 'DEFIS' AND status = 'pending';
```

E pra DASN-SIMEI: `due_month = 5`.

### "Status 'Atrasada' não aparece em obrigações vencidas"

Verifique se `effectiveStatus()` está sendo usado:

```bash
grep -rn "effectiveStatus\|status === \"overdue\"" features/ app/
```

Em qualquer tab que conta "atrasadas", deveria usar `effectiveStatus(o) === "overdue"`,
não `o.status === "overdue"` (que só pega status salvo no banco).

### "Filtro de período não filtra essa página"

Confirmações:
1. A página chama `useSelectedPeriod()`?
2. Aplica `isInPeriod(date)` em algum filter?
3. Os contadores (tabs) também respeitam o filtro?

Páginas que devem filtrar: dashboard, obrigações, impostos, parcelamentos,
calendário. Página /relatorios **intencionalmente** tem filtro próprio.

### "Erro de hooks: rendered more hooks than previous render"

React Error #310 — algum `useMemo`/`useState`/`useEffect` está depois
de um `if (...) return ...`. Mover **todos os hooks** pro topo do
componente, antes de qualquer early return.

Já aconteceu uma vez no `app/page.tsx` — ver commit `3101a18`.

## Papéis e acesso

O acesso aos dados é decidido **no banco** (RLS, `scripts/023`) pelo
`app_metadata.role` do token — o usuário não consegue alterá-lo:

| Papel | Lê | Grava |
|---|---|---|
| `admin` / `editor` | tudo (inclusive histórico, apuração, guias, parcelamentos, serviços) | tudo, exceto o histórico (só os gatilhos gravam) |
| `viewer` | empresas, obrigações (indicadores do Dashboard), competências fechadas, feriados | nada |
| sem papel / login anônimo | nada (o app mostra "Acesso aguardando liberação") | nada |

**Decisão (LGPD):** o viewer não lê guias (valores), parcelamentos,
serviços, apuração (faturamento, pró-labore, sócios) nem o histórico. Os
indicadores do Dashboard dele usam só as obrigações acessórias — por isso
o viewer lê `obligations` (nome, competência, status e vencimento; sem
valores).

Definir/alterar o papel de alguém (SQL Editor; troque e-mail e papel):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"editor"}'::jsonb
where email = 'pessoa@escritorio.com';
```

A pessoa precisa **sair e entrar** de novo (ou esperar até 1h) para o token
carregar o papel novo — o app tenta renovar o token sozinho ao abrir. Tirar
o acesso: troque `editor` por `viewer` ou remova a chave
(`raw_app_meta_data - 'role'`) — vale a partir do próximo token (até 1h).

Conferir quem tem qual papel:

```sql
select email, raw_app_meta_data ->> 'role' as papel, last_sign_in_at
from auth.users order by papel nulls first, email;
```

### Checklist do painel do Supabase (segurança)

- [ ] **Authentication → Sign In / Providers → Email**: desligar
      **"Allow new users to sign up"** (contas só pelo painel/convite).
- [ ] **Authentication → Sign In / Providers**: desligar
      **"Allow anonymous sign-ins"**.
- [ ] **Authentication → Attack Protection**: ligar **leaked password
      protection** (HaveIBeenPwned) e exigir senha forte.
- [ ] **Authentication → Multi-Factor**: habilitar **TOTP** e pedir que a
      equipe ative MFA.
- [ ] **Authentication → URL Configuration**: Site URL e Redirect URLs só
      com o domínio do sistema.
- [ ] **Advisors → Security Advisor**: rodar e conferir que não há
      "RLS disabled" nem "Function search_path mutable".
- [ ] `service_role` nunca no frontend nem no Vercel como `NEXT_PUBLIC_*`.
- [ ] Vercel: `NEXT_PUBLIC_SUPABASE_URL` precisa existir no **build** (a CSP
      libera só a origem desse projeto); sem ela, produção responde 503.

### Aplicar o 023 num banco que já está em produção

**Antes**

1. Faça um backup (Database → Backups, ou `pg_dump`, ver [Backup](#backup)).
2. Confira se o banco já tem `016`…`022` (o 023 recusa rodar sem `020`,
   `021` e `022`):
   ```sql
   select to_regclass('public.locked_periods'), to_regclass('public.office_holidays'),
          to_regclass('public.apuracao_mensal_revisoes');
   ```
   Se algum vier `null`, rode os scripts que faltam (ordem da tabela acima).
3. Liste as contas e anote quem deve ser `viewer` (a primeira execução dá
   `editor` a toda conta existente sem papel):
   ```sql
   select email, raw_app_meta_data ->> 'role' as papel from auth.users order by 2 nulls first, 1;
   ```
4. Publique o app desta versão **junto** (o app novo trata "sem papel" e só
   carrega o que o viewer pode ler).

**Rodar**

5. SQL Editor → cole `scripts/023_papeis_auditoria.sql` → Run. Em
   "Messages" aparece `023: N conta(s) existentes sem papel receberam
   role=editor.` Rodar de novo é seguro (diz "backfill de papéis já
   aplicado").
6. Ajuste quem deve ser `viewer` (SQL acima) e peça para **todos saírem e
   entrarem** de novo.

**Depois (conferir)**

7. Papéis: a consulta do passo 3 não deve ter ninguém da equipe com papel vazio.
8. Políticas: `select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;`
   → só `papel: leitura / incluir / alterar / excluir` (history e
   apuracao_mensal_revisoes só `papel: leitura`).
9. Funções sem `search_path` fixo (deve voltar vazio):
   ```sql
   select p.oid::regprocedure from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
   ```
10. No app: editor cria/edita/exclui uma obrigação; fecha e reabre uma
    competência (em `history` aparecem `locked`/`unlocked` com o e-mail);
    viewer vê Dashboard/Empresas sem guias/parcelamentos; `/publico` sem
    lista de empresas.

**Reverter (emergência)**

Rode `scripts/rollback/023_reverter.sql` e depois `017`, `019`, `020`,
`021`, `022` (nesta ordem): volta ao modelo antigo (qualquer logado lê; quem
não é viewer grava). Histórico protegido, carimbo do fechamento e as
correções de trava continuam. Para voltar ao 023, rode-o de novo. Ou
restaure o backup do passo 1.

### Testar os scripts SQL localmente

`npm test` roda `scripts/__tests__/migrations.test.ts` num **Postgres real
em WASM (PGlite)**, sem servidor e sem tocar em nenhum Supabase:
`scripts/__tests__/pg-harness.ts` cria os papéis `anon`/`authenticated`,
`auth.users`, `auth.jwt()`/`auth.uid()`/`auth.role()` e os privilégios
padrão do Supabase, e troca de "sessão" como o PostgREST faz (`set role` +
`request.jwt.claims`). Para testar outra pasta de scripts:
`SQL_SCRIPTS_DIR=/caminho/scripts npx vitest run scripts/__tests__`.

## Custos esperados

| Serviço | Plano | Custo | Limites |
|---|---|---|---|
| Vercel | Hobby | $0 | 100GB bandwidth, 6000 build mins/mês |
| Supabase | Free | $0 | 500MB DB, 1GB storage, 50K MAU |
| Open-Meteo (clima) | Free | $0 | Ilimitado pra uso pessoal |
| ipapi.co (IP geo) | Free | $0 | 1000 req/dia |
| BigDataCloud (reverse geo) | Free | $0 | Ilimitado client-side |
| **Total** | | **$0/mês** | |

Quando crescer:
- **Supabase Pro** ($25/mês): backups diários, 8GB DB, melhor pra +50 empresas
- **Vercel Pro** ($20/mês): só vale se passar dos limites de bandwidth ou se quiser password protect

## Logs e monitoramento

### Vercel
- **Runtime logs**: Vercel Dashboard → Logs (últimos 30 dias)
- **Build logs**: cada deploy tem o log completo

### Supabase
- **Database logs**: Supabase Dashboard → Database → Logs
- **API logs**: Settings → API → Logs (mostra requests e erros)

### No browser do usuário
- DevTools → Console — erros de runtime, warnings
- DevTools → Network — requests do Supabase
- DevTools → Application → Local Storage — cache de templates, flags

## Atualizando o sistema

Quando rolar mudança grande:

1. Cria branch a partir de `main`
2. Faz mudanças + commits + push
3. Abre PR no GitHub (Vercel cria preview deployment automaticamente)
4. Testa no preview URL antes de mergear
5. Mergeia → Vercel detecta e publica em produção (~1-2 min)

**Sempre que adicionar/mudar coluna no Supabase:**
1. Cria `scripts/00X_*.sql`
2. Roda **antes** do merge — se rodar depois, a versão nova vai
   tentar SELECT/INSERT em coluna que não existe e quebrar

## Contato / suporte

- Bug ou pedido novo: abrir issue no GitHub do projeto
- Dúvida sobre fiscal: consultar contador (sistema é só ferramenta)
- Dúvida sobre Supabase: [docs oficiais](https://supabase.com/docs)
- Dúvida sobre Next.js: [docs oficiais](https://nextjs.org/docs)
