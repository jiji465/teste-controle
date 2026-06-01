"use client"

/**
 * template.tsx do App Router: diferente do layout.tsx, ESTE componente
 * RE-MONTA a cada navegação entre páginas. Isso faz o conteúdo "entrar"
 * suavemente (fade + sobe) toda vez que o usuário troca de aba, dando a
 * sensação de fluidez sem biblioteca de animação.
 *
 * A animação em si está em globals.css (.page-enter) e respeita
 * prefers-reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
