"use client"

// Relatório Executivo — gerador de apuração fiscal mensal portado do "SETE Apuração"
// (template-sete). Editor + motor de cálculo + relatório em PDF, integrado ao
// controle fiscal: a empresa vem de useData() e as competências são salvas via services.
import SeteApuracao from "@/features/apuracao/sete/SeteApuracao"

export default function RelatoriosExecutivosPage() {
  return <SeteApuracao />
}
