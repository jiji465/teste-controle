# Guia do Usuário

Este guia mostra como usar cada parte do sistema, do dia-a-dia até as
operações em lote.

## Filtro global de período

Todo o sistema respeita o **PeriodSwitcher** no topo da página (badge com
o mês selecionado, ex: `📅 Abril 2026`).

- **Setas ◀ ▶** — navega entre meses.
- **Hoje** — volta pro mês atual real.
- **Ver todos** — desativa o filtro, mostra dados de todos os períodos.

Quando há filtro ativo, o **dashboard, listas, gráficos e contadores**
todos refletem só aquele mês.

## Dashboard (página inicial)

Estrutura, de cima pra baixo:

1. **Saudação dinâmica** — "Bom dia / Boa tarde / Boa noite" com cor
   adaptada ao horário (manhã âmbar, tarde azul, noite índigo). Mostra
   também data por extenso e progresso do mês.
2. **Widget de clima** — pega sua localização (silenciosamente; se você
   negar, fallback via IP) e mostra temperatura + condição + cidade.
   Usa Open-Meteo (gratuita).
3. **Resumo Geral** — 5 cards: Clientes, Obrigações, Concluídas no mês,
   Atrasadas, Esta semana.
4. **Distribuição** — 3 gráficos:
   - Saúde das Obrigações (% concluídas, gauge radial)
   - Regime Tributário (donut com gradient)
   - Atividade Empresarial (barras verticais)
   - Empresas por Estado (leaderboard ranqueado)
5. **Próximos Vencimentos** — Próximas Obrigações + Próximas Guias de
   Imposto (filtradas pelo período).
6. **Indicadores de Produtividade** — taxa no prazo, em andamento,
   atrasadas, concluídas.
7. **Clientes & Atividade** — top clientes por pendências e atividade
   recente (concluídas, atrasadas, criadas).

## Empresas (`/clientes`)

Cadastro dos clientes do escritório (CNPJ).

**Campos principais:**
- Razão Social, Nome Fantasia, CNPJ
- Regime tributário (Simples Nacional, Lucro Presumido, Lucro Real, MEI, Imune/Isento)
- Atividade (Serviços, Comércio, Indústria, Misto)
- Endereço (rua, cidade, UF, CEP)
- Contato (e-mail, telefone)
- IE / IM
- CNAE
- Status (ativo/inativo)

**Atalhos:**
- 🔍 Busca: nome, fantasia, CNPJ, e-mail, IE, IM, atividade, CNAE
- **Filtros pill** (clica em cada): Regime, Status, Atividade, Estado
- **Ordenação A-Z** clicando nos headers da tabela: Nome, CNPJ, Regime, Estado, Status
- **Resize de colunas** arrastando a borda direita do header (largura persiste)
- **Seleção múltipla** + ações em lote: Aplicar Template, Ativar, Desativar, Excluir
- **Auto-preenchimento** ao digitar CNPJ (via BrasilAPI) — confere se a
  empresa existe e preenche razão social, endereço, atividade

## Guias de Imposto (`/impostos`)

Impostos a pagar (DAS, IRPJ, ISS, ICMS, etc) por competência.

**Tabs no topo:**
- Todos / Pendentes / Em Andamento / Concluídos / **Atrasados**
- Os contadores mostram só o que está no período filtrado
- "Atrasados" inclui pending com data passada (cálculo dinâmico)

**Campos:**
- Nome (DAS, IRPJ Trimestral, ISS, etc)
- Cliente
- Esfera (Federal, Estadual, Municipal)
- Mês de competência (ex: "2026-03")
- Dia do vencimento
- **Mês fixo de vencimento** (opcional, só pra anuais — ex: DEFIS = março)
- Recorrência (Mensal, Bimestral, Trimestral, Semestral, Anual)
- Regra de fim de semana (Antecipa / Posterga / Mantém)
- Prioridade (Baixa, Média, Alta, Urgente)

**Filtros pill:** Cliente, Regime, Esfera, Prioridade, Competência

**Ações inline na tabela:**
- ▶️ Iniciar (vira "Em Andamento")
- ✓ Concluir (vira "Concluído")
- ⋮ Menu: Editar, Excluir

**Bulk actions** (após selecionar várias):
- Concluir, Em andamento, Reabrir, Editar (mudar prioridade/dueDay
  em massa), Excluir.

## Obrigações Acessórias (`/obrigacoes`)

Declarações ao Fisco (DCTFWeb, SPED, DEFIS, ECF, ECD, etc).

Mesma interface das Guias, mas com:
- Coluna **Regimes** aplicáveis (em vez de Esfera)
- Campo **Tags** pra categorização livre
- Campo **Protocolo** pra registrar nº do recibo de entrega
- Filtro adicional **Regime Tributário**

## Parcelamentos (`/parcelamentos`)

REFIS e parcelamentos de débitos.

**Diferenças:**
- **firstDueDate** = data da 1ª parcela
- **installmentCount** = total de parcelas (ex: 60 meses)
- **currentInstallment** = parcela atual sendo paga
- O sistema calcula a próxima data automaticamente:
  `firstDueDate + (currentInstallment - 1) meses`

**Filtros:** Cliente, Prioridade

## Templates (`/templates`)

Pacotes de obrigações pré-configurados pra aplicar em várias empresas
de uma vez.

**Templates padrão criados automaticamente:**
- 4 do Simples Nacional (Serviços/Comércio/Indústria/Misto)
- 4 do Lucro Presumido trimestral
- 4 do Lucro Presumido com IRPJ/CSLL Mensal

> MEI e Lucro Real foram **removidos do seed padrão** a pedido do usuário.
> Você pode criar manualmente se precisar.

**Funcionalidades principais:**
- Criar / editar / duplicar / excluir templates
- **Selecionar múltiplos** com checkbox + bulk:
  - Adicionar item (catálogo OU personalizado) em vários templates de uma vez
  - Duplicar selecionados
  - Excluir selecionados
- **Catálogo de itens** — atalho pra adicionar DAS, ISS, ICMS, INSS, etc
  já pré-configurados (esfera, dia, regra de fim de semana)
- **Edição em lote dentro do template** — selecionar vários itens
  do template + aplicar mesma prioridade/esfera/recorrência

**"Restaurar padrões"** — apaga TODOS os templates "Padrão · ..."
existentes e recria as versões atualizadas. Não toca nos seus templates
personalizados.

**Atenção — defaults deletados não voltam**
Quando você apaga um template padrão, ele entra numa "lista negra" e
NÃO volta nem com "Restaurar padrões". Isso é intencional: respeita
sua decisão. Se quiser ele de volta, crie manualmente.

## Aplicar Template em Empresas

1. Vai em **Empresas** (`/clientes`)
2. Marca o checkbox das empresas que quer
3. No bulk action bar, clica em **"Aplicar Template"**
4. Dialog abre com:
   - O template do regime+atividade dela já pré-selecionado (se 1 empresa)
   - Lista de itens do template — desmarca os que não quer
   - **Período de competência** (ex: "2026-01" a "2026-12")
5. Clica "Aplicar" → sistema cria todas as obrigações pra cada empresa

**Dedupe automático:** se a empresa já tem aquela obrigação no mesmo
mês, o sistema **pula** (não duplica). O resultado mostra
"X criados · Y já existiam".

## Calendário Fiscal (`/calendario`)

Visão mensal estilo Google Calendar dos vencimentos.

- Cada dia mostra **até 3 vencimentos** + contador "+N" se tiver mais
- **Feriados nacionais** nomeados em laranja (ex: "🎉 Tiradentes")
- **Hoje** destacado em azul
- Click no dia abre dialog com TODOS os vencimentos do dia + ações
  rápidas pra cada um

## Relatórios (`/relatorios`)

Análise por período (Este mês / Mês passado / Trimestre / Ano).

> ⚠️ **Não usa o filtro global** de período — tem seu próprio seletor interno.

**Mostra:**
- Taxa de conclusão geral
- % concluído no prazo
- Por cliente (quantas obrigações, status)
- Por imposto (DAS, ICMS, etc — quantas e taxa de conclusão)
- Por recorrência (quantas mensais, trimestrais, anuais)

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Ctrl/⌘ + K` | Abre busca global (em qualquer página de listagem) |
| `Esc` | Fecha dialogs/modais |

## FAQ

**P: Quando eu marco como "Concluído" mas a data ainda não chegou, ele continua aparecendo como concluído?**
R: Sim. Status manual sobrescreve cálculo automático.

**P: Quando deleto uma empresa, as obrigações dela somem?**
R: Sim. Tem confirmação explícita antes ("Atenção: as obrigações e
parcelamentos associados também serão removidos").

**P: Posso usar de mais de um computador?**
R: Sim. Os dados ficam no Supabase, sincronizam automaticamente. Tem
auto-refresh quando você volta pra aba (depois de 10s).

**P: Como exportar tudo pra Excel?**
R: Cada página de listagem tem botão "Exportar" no canto superior
direito → gera .xlsx ou .csv com filtros aplicados.

**P: O sistema funciona offline?**
R: Parcialmente. Templates ficam em cache no localStorage e funcionam
sem internet. Mas obrigações/impostos exigem Supabase online.

**P: Por que algumas datas aparecem com "🎉 ← Feriado: Tiradentes"?**
R: Quando o vencimento original cai em feriado/fim de semana e a regra
é "antecipar", o sistema mostra a data ajustada + indica qual feriado
causou o ajuste.
