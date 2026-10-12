"use client"

// Relatório Executivo — gerador de apuração fiscal mensal portado do "SETE Apuração"
// (template-sete). Editor + motor de cálculo + relatório em PDF, integrado ao
// controle fiscal: a empresa vem de useData() e as competências são salvas via services.
import dynamic from "next/dynamic"
import { PageSkeleton } from "@/components/page-skeleton"

// Módulo grande (~200 KB de editor + motor + PDF): carrega sob demanda.
const SeteApuracao = dynamic(() => import("@/features/apuracao/sete/SeteApuracao"), {
  ssr: false,
  loading: () => <PageSkeleton />,
})

export default function RelatoriosExecutivosPage() {
  return <SeteApuracao />
}
