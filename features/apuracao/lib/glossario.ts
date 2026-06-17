// Glossário tributário — exibido no relatório executivo conforme os tributos presentes.
export interface GlossItem {
  sigla: string
  nome: string
  match: string[]
  desc: string
}

export const GLOSSARY: GlossItem[] = [
  { sigla: "DAS", nome: "Documento de Arrecadação do Simples", match: ["DAS"], desc: "Guia única do Simples Nacional que reúne vários tributos em uma só alíquota e um só pagamento." },
  { sigla: "IRPJ", nome: "Imposto de Renda Pessoa Jurídica", match: ["IRPJ", "Adicional IRPJ"], desc: "Imposto federal sobre o lucro. No Lucro Presumido, vence por trimestre." },
  { sigla: "CSLL", nome: "Contribuição Social sobre o Lucro Líquido", match: ["CSLL"], desc: "Contribuição federal que financia a seguridade social, calculada sobre o lucro." },
  { sigla: "PIS / COFINS", nome: "Contribuições sobre o faturamento", match: ["PIS", "COFINS"], desc: "Contribuições federais que incidem sobre a receita bruta da empresa." },
  { sigla: "ISS", nome: "Imposto Sobre Serviços", match: ["ISS", "ISS (próprio)"], desc: "Imposto municipal cobrado sobre a prestação de serviços." },
  { sigla: "ICMS", nome: "Imposto sobre Circulação de Mercadorias", match: ["ICMS"], desc: "Imposto estadual sobre a circulação de mercadorias e alguns serviços." },
  { sigla: "CPP", nome: "Contribuição Previdenciária Patronal", match: ["CPP (Patronal)"], desc: "Contribuição de 20% da empresa sobre a folha de salários e o pró-labore." },
  { sigla: "RAT / Terceiros", nome: "Encargos sobre a folha", match: ["RAT", "Terceiros"], desc: "RAT financia benefícios por acidente; Terceiros destina-se ao Sistema S (SESC, SENAC, SEBRAE...)." },
  { sigla: "FGTS", nome: "Fundo de Garantia do Tempo de Serviço", match: ["FGTS"], desc: "Depósito de 8% sobre a remuneração de cada empregado." },
  { sigla: "INSS (Pró-labore)", nome: "Contribuição do segurado", match: ["INSS (Pró-labore)"], desc: "Retenção de 11% sobre a retirada de pró-labore dos sócios." },
  { sigla: "Fator R", nome: "Relação Folha ÷ Faturamento", match: ["DAS"], desc: "Se a folha + pró-labore dos últimos 12 meses for ≥ 28% do faturamento, a empresa paga menos imposto (Anexo III em vez do V)." },
]
