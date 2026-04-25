# Evolução do Hub de Operações Fiscais: Foco em Controle e Visão Gerencial

Este plano detalha a implementação das funcionalidades solicitadas para escalar o controle, a segurança e a visibilidade dos dados gerenciais.

## Funcionalidades a Implementar (Frentes 2 e 3)

### 1. Fechamento e Bloqueio de Período (Lock Period)
*   **Controle de Fechamento:** Criar uma nova estrutura de dados para armazenar quais meses/anos estão "fechados" (ex: `locked_periods = ["2025-01"]`).
*   **Restrição de Acesso:** Se o contador navegar para um período fechado no `PeriodSwitcher`, o Hub de Operações e as listas entrarão em modo "Somente Leitura" (read-only), impedindo alterações de status, edições ou exclusões de tarefas passadas.
*   **Ação de Fechar:** Um botão no Dashboard (visível quando as tarefas do mês estão 100% concluídas) para "Lacrar Período".

### 2. Controle de SLA (Avisos de Urgência)
*   **Monitor de Vencimento:** Implementar lógica no `OperationHub` para calcular os dias restantes para o vencimento de cada obrigação.
*   **Alertas Visuais:** Se faltarem ≤ 2 dias úteis e a tarefa estiver pendente, ela receberá um destaque visual em vermelho 🚨 ("Vence em Breve" / "Urgente") para furar a fila de prioridades.

### 3. Visão de Calendário (Agenda Fiscal)
*   **Nova Página / Componente:** Criar uma aba ou página dedicada com um Calendário Mensal visual.
*   **Distribuição de Carga:** O calendário mostrará os "picos" de vencimentos ao longo dos dias do mês (ex: dias 15, 20, 25), permitindo que o gerente entenda o volume de entregas e planeje o time de forma eficiente.

### 4. Indicadores de Produtividade (Dashboards do Gerente)
*   **Métricas Operacionais:** Adicionar ao topo do Dashboard indicadores-chave:
    *   Guias entregues no prazo vs. Entregues com atraso.
    *   Volume de tarefas pendentes por analista.
    *   Eficiência do período (%).

## Proposed Changes

### Storage e Banco de Dados (lib)
#### [MODIFY] `lib/storage.ts` e `lib/supabase/database.ts`
- Adicionar chaves e métodos para gerenciar `LOCKED_PERIODS` (`getLockedPeriods`, `togglePeriodLock`).

### Segurança e Bloqueios (components)
#### [MODIFY] `components/operation-hub.tsx`
- Integrar verificação de `isPeriodLocked`.
- Se `isPeriodLocked` for `true`, desabilitar checkboxes, botões de ação e exibir o status "🔒 Período Encerrado".
- Implementar a lógica de cálculo de SLA (destaque vermelho) para tarefas próximas do vencimento.

### Novas Visões e Dashboards (app & components)
#### [NEW] `components/fiscal-calendar.tsx`
- Componente que exibe os dias do mês em formato grid (agenda) e preenche os dias com as obrigações pendentes/concluídas, agrupadas por data de vencimento.
#### [MODIFY] `app/page.tsx` (Dashboard)
- Integrar gráficos de "Indicadores de Produtividade" (usando Recharts, se necessário, ou cards numéricos detalhados) avaliando SLA e atrasos.
- Adicionar o controle global para o Gerente poder fechar o mês.

## Verification Plan
1. **SLA:** Modificar uma obrigação para vencer amanhã e verificar se o sistema altera sua aparência para "Urgente" na cor vermelha.
2. **Lock Period:** Clicar em "Fechar Período", recarregar a página e tentar editar/concluir uma tarefa. O sistema deve bloquear totalmente a ação.
3. **Calendário:** Abrir a visão de agenda fiscal e confirmar que as obrigações estão renderizadas exatamente no dia do mês correspondente ao `dueDay`.
4. **Dashboards:** Concluir algumas tarefas com atraso (data de conclusão > dueDay) e verificar se o gráfico de SLA reflete a queda de eficiência.
