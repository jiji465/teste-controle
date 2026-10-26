/**
 * Campos de conclusão ao salvar pelo formulário. Concluído → mantém a data e
 * o responsável já gravados (ou registra agora); qualquer outro status →
 * limpa a conclusão (antes, voltar para "Pendente" deixava completedAt e o
 * item seguia contando como entregue em relatórios).
 */
export function completionFields(
  status: string,
  previous: { completedAt?: string | null; completedBy?: string | null } | undefined,
  opts: { now: string; userName?: string; formCompletedAt?: string | null; formCompletedBy?: string | null },
): { completedAt?: string; completedBy?: string } {
  if (status !== "completed") return { completedAt: undefined, completedBy: undefined }
  return {
    completedAt: opts.formCompletedAt ?? previous?.completedAt ?? opts.now,
    completedBy: opts.formCompletedBy ?? previous?.completedBy ?? opts.userName ?? undefined,
  }
}

export type FormMappingOptions = {
  /** ISO do momento do salvamento (injetável nos testes). */
  now?: string
  userName?: string
}
