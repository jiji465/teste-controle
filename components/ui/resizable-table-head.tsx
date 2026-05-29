"use client"

import { type ReactNode } from "react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type ResizableTableHeadProps = {
  /** Largura fixa da coluna em px. */
  defaultWidth: number
  /** @deprecated não usado mais — mantido só pra compatibilidade de assinatura. */
  minWidth?: number
  /** @deprecated não usado mais. */
  maxWidth?: number
  /** @deprecated não usado mais — antes persistia a largura no localStorage. */
  storageKey?: string
  className?: string
  children: ReactNode
}

/**
 * Cabeçalho de coluna com largura FIXA.
 *
 * ⚠️ Histórico: antes este componente permitia arrastar a borda pra
 * redimensionar e salvava a largura no localStorage pra sempre. Isso causava
 * dois problemas pro usuário:
 *   1. Uma coluna esticada (às vezes sem querer) ficava larga permanentemente,
 *      sem botão de resetar — e a tabela estourava a largura da tela.
 *   2. A alça de arrastar ficava na borda direita de cada cabeçalho; ao tentar
 *      ROLAR a tabela pra direita, o usuário esticava a coluna em vez de rolar.
 *
 * Por isso o redimensionamento foi removido. O componente agora é só um
 * `<TableHead>` de largura fixa. Como não lê mais o localStorage, qualquer
 * largura "travada" de antes é automaticamente ignorada (reset). A assinatura
 * (defaultWidth, storageKey, etc.) foi mantida pra não quebrar os call sites;
 * `defaultWidth` continua definindo a largura. Combine com `table-fixed` na
 * `<Table>` pra que a largura seja respeitada e o texto longo seja truncado.
 */
export function ResizableTableHead({
  defaultWidth,
  className,
  children,
}: ResizableTableHeadProps) {
  return (
    <TableHead
      className={cn(className)}
      style={{ width: `${defaultWidth}px` }}
    >
      {children}
    </TableHead>
  )
}
