import { z } from "zod"
import { isValidDocument } from "@/lib/cnpj-validation"

export const taxRegimeSchema = z.enum([
  "simples_nacional",
  "lucro_presumido",
  "lucro_real",
  "mei",
  "imune_isento"
])

export const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
  tradeName: z.string().optional(),
  // Documento OPCIONAL: CNPJ (inclusive alfanumérico) ou CPF de pessoa
  // física. Se preenchido, os dígitos verificadores precisam bater.
  cnpj: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidDocument(v), "CNPJ/CPF inválido (verifique os dígitos)"),
  email: z.string().email("E-mail inválido").or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  // Obrigatório: define os templates/obrigações aplicáveis à empresa
  taxRegime: taxRegimeSchema.optional().refine((v) => !!v, "Regime tributário é obrigatório"),
  businessActivity: z.string().optional(),
  cnaeCode: z.string().optional(),
  cnaeDescription: z.string().optional(),
  ie: z.string().optional(),
  im: z.string().optional(),
  city: z.string().optional(),
  // UF sempre em maiúsculas (o filtro de UF compara exato)
  state: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : v)),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
