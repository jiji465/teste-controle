import type { BusinessActivity } from "./obligation-templates"

// Mapeia a Seção CNAE (2 primeiros dígitos do código CNAE 2.3 do IBGE)
// para a BusinessActivity usada pelos templates do sistema.
// Seções não listadas caem no default "servicos", que cobre a maior parte
// do espectro de CNAE (35..99: eletricidade, transporte, financeiro, saúde etc.).
const CNAE_SECTION_MAP: Record<string, BusinessActivity> = {
  "01": "industria", "02": "industria", "03": "industria",
  "05": "industria", "06": "industria", "07": "industria", "08": "industria", "09": "industria",
  "10": "industria", "11": "industria", "12": "industria", "13": "industria",
  "14": "industria", "15": "industria", "16": "industria", "17": "industria",
  "18": "industria", "19": "industria", "20": "industria", "21": "industria",
  "22": "industria", "23": "industria", "24": "industria", "25": "industria",
  "26": "industria", "27": "industria", "28": "industria", "29": "industria",
  "30": "industria", "31": "industria", "32": "industria", "33": "industria",
  "45": "comercio", "46": "comercio", "47": "comercio",
}

export function inferBusinessActivityFromCNAE(
  cnae: string | number | null | undefined,
): BusinessActivity | null {
  if (cnae == null) return null
  const digits = String(cnae).replace(/\D/g, "")
  if (digits.length < 2) return null
  const section = digits.slice(0, 2)
  return CNAE_SECTION_MAP[section] ?? "servicos"
}
