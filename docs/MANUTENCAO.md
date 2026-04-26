# Manutenção e Operação

Guia operacional pra quem cuida do sistema (deploy, backup,
troubleshooting). Misturado de "leigo" e "técnico" — ambos servidos.

## Setup inicial do Supabase

Se você está montando o sistema do zero:

### 1. Criar projeto

1. Acesse [supabase.com](https://supabase.com) → "New Project"
2. Escolhe nome, senha do DB e região (escolha **South America (São Paulo)**)
3. Anota a senha do DB num lugar seguro

### 2. Rodar SQL inicial

No Supabase Dashboard → **SQL Editor** → "New query":

```sql
-- Cole o conteúdo de scripts/setup_complete.sql e clica em Run
```

Isso cria todas as tabelas + índices + funções básicas.

### 3. Aplicar migrations incrementais

Em ordem, rode no SQL Editor (cada um é idempotente):

1. `scripts/004_align_schema_and_templates.sql` — campos extras em clientes/impostos + tabela templates
2. `scripts/005_templates_full_persistence.sql` — campos regime/activity em templates + tabela deleted_default_templates
3. `scripts/006_taxes_due_month.sql` — coluna due_month em taxes (pra DEFIS, DASN-SIMEI)

> 📝 Os scripts 002 e 003 são intermediários — se você rodou o
> setup_complete já estão cobertos. Se está partindo de uma instalação
> antiga, rode tudo na ordem.

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

## Quando ativar Auth + RLS

Hoje o sistema usa só anon key, sem login. Quando crescer pra
multi-usuário (vários contadores no mesmo escritório):

1. **Supabase** → **Authentication** → ativa Email + Magic Link
2. Adiciona `user_id UUID REFERENCES auth.users` em todas as tabelas
3. Cria policies RLS:
   ```sql
   CREATE POLICY "Users see only their data"
   ON public.clients FOR ALL
   USING (auth.uid() = user_id);
   ```
4. No app, captura `auth.uid()` e adiciona no save
5. Login UI: `@supabase/auth-helpers-nextjs`

> Quando for fazer isso, considere uso significativo. Pra 1 contador
> sozinho, não vale a complexidade.

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
