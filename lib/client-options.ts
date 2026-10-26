import type { Client } from "./types"

/**
 * Empresas oferecidas nos selects de NOVOS itens: só as ativas. A empresa já
 * vinculada ao item em edição continua na lista mesmo arquivada (senão o
 * Select ficaria vazio e o item perderia o vínculo ao salvar).
 */
export function selectableClients(clients: Client[], currentClientId?: string | null): Client[] {
  return clients.filter((c) => c.status !== "inactive" || (!!currentClientId && c.id === currentClientId))
}
