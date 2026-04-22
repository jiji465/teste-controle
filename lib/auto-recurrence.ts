import {
  getLastRecurrenceCheck,
  setLastRecurrenceCheck,
} from "./storage"
import {
  getObligations,
  getTaxes,
  getInstallments,
  saveObligation,
  saveTax,
  saveInstallment,
} from "./supabase/database"
import {
  shouldGenerateRecurrence,
  getCurrentPeriod,
  generateObligationForPeriod,
  generateTaxForPeriod,
  generateInstallmentForPeriod,
} from "./recurrence-engine"

export async function checkAndGenerateRecurrences(): Promise<void> {
  const now = new Date()
  const currentPeriod = getCurrentPeriod()
  const lastCheck = getLastRecurrenceCheck()

  // Verifica se já rodou hoje
  const today = now.toISOString().split("T")[0]
  if (lastCheck === today) {
    return
  }

  // Verifica se é o primeiro dia do mês
  if (!shouldGenerateRecurrence(now)) {
    return
  }

  console.log("[v0] Iniciando geração automática de recorrências para", currentPeriod)

  try {
    const { calculateNextDueDate } = await import("./recurrence-utils")
    
    // Gerar obrigações recorrentes
    const obligations = await getObligations()
    const obligationsToGenerate = obligations.filter(
      (o) => o.autoGenerate && !o.parentObligationId, // Apenas obrigações originais
    )

    for (const obligation of obligationsToGenerate) {
      // Find all generated instances for this obligation
      const instances = obligations.filter((o) => o.parentObligationId === obligation.id || o.id === obligation.id)
      
      // Find the latest due date among all instances
      let latestInstance = instances[0]
      let latestDueDate = new Date(0)
      
      for (const inst of instances) {
        // Need to calculate the due date properly, since it might not be saved directly on the DB object
        // but we can use the creation date / generatedFor as a proxy, or calculate it.
        // For simplicity, we just use the recurrence engine
        const period = inst.generatedFor || `${new Date(inst.createdAt).getFullYear()}-${String(new Date(inst.createdAt).getMonth() + 1).padStart(2, "0")}`
        const [year, month] = period.split("-").map(Number)
        const dueDate = new Date(year, month - 1, inst.dueDay || 1)
        if (dueDate > latestDueDate) {
          latestDueDate = dueDate
          latestInstance = inst
        }
      }

      // Check if the latest due date is older than the current period (or current month)
      const nextDate = calculateNextDueDate(obligation, latestDueDate)
      
      // If the next calculated due date is in the current month or earlier, we generate it
      const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`
      
      if (nextPeriod <= currentPeriod) {
        // Verify it doesn't already exist
        const alreadyGenerated = obligations.some(
          (o) => o.parentObligationId === obligation.id && o.generatedFor === nextPeriod,
        )

        if (!alreadyGenerated) {
          const newObligation = generateObligationForPeriod(obligation, nextPeriod)
          await saveObligation(newObligation)
          console.log("[v0] Obrigação gerada:", newObligation.name, "para", nextPeriod)
        }
      }
    }

    // Gerar impostos recorrentes
    const taxes = await getTaxes()
    const taxesToGenerate = taxes.filter((t) => t.dueDay !== undefined)

    for (const tax of taxesToGenerate) {
      // Verifica se já existe um imposto gerado para este período
      const alreadyGenerated = taxes.some((t) => t.name === tax.name && t.createdAt.startsWith(currentPeriod))

      if (!alreadyGenerated) {
        const newTax = generateTaxForPeriod(tax, currentPeriod)
        await saveTax(newTax)
        console.log("[v0] Imposto gerado:", newTax.name, "para", currentPeriod)
      }
    }

    // Gerar parcelas recorrentes
    const installments = await getInstallments()
    const installmentsToGenerate = installments.filter((i) => i.autoGenerate && i.currentInstallment < i.installmentCount)

    for (const installment of installmentsToGenerate) {
      const newInstallment = generateInstallmentForPeriod(installment, currentPeriod)
      await saveInstallment(newInstallment)
      console.log(
        "[v0] Parcela gerada:",
        newInstallment.name,
        `${newInstallment.currentInstallment}/${newInstallment.installmentCount}`,
        "para",
        currentPeriod,
      )
    }

    // Atualiza a data da última verificação
    setLastRecurrenceCheck(today)
    console.log("[v0] Geração automática de recorrências concluída")
  } catch (error) {
    console.error("Erro ao gerar recorrências:", error)
  }
}

// Hook para executar a verificação quando o app carrega
export function initializeAutoRecurrence(): void {
  if (typeof window !== "undefined") {
    // Executa imediatamente
    checkAndGenerateRecurrences()

    // Configura verificação diária (a cada 24 horas)
    setInterval(checkAndGenerateRecurrences, 24 * 60 * 60 * 1000)
  }
}
