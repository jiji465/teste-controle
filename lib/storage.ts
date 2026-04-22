import type { Client, Tax, Obligation, Installment } from "./types"

const STORAGE_KEYS = {
  CLIENTS: "fiscal_clients",
  TAXES: "fiscal_taxes",
  OBLIGATIONS: "fiscal_obligations",
  INSTALLMENTS: "fiscal_installments",
  COMPLETED_OBLIGATIONS: "fiscal_completed_obligations",
  COMPLETED_TAXES: "fiscal_completed_taxes",
  COMPLETED_INSTALLMENTS: "fiscal_completed_installments",
  LAST_RECURRENCE_CHECK: "fiscal_last_recurrence_check",
}

// Client Storage
export const getClients = (): Client[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.CLIENTS)
  return data ? JSON.parse(data) : []
}

export const saveClient = (client: Client): void => {
  const clients = getClients()
  const index = clients.findIndex((c) => c.id === client.id)
  if (index >= 0) {
    clients[index] = client
  } else {
    clients.push(client)
  }
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients))
}

export const deleteClient = (id: string): void => {
  const clients = getClients().filter((c) => c.id !== id)
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients))
}

// Tax Storage
export const getTaxes = (): Tax[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.TAXES)
  return data ? JSON.parse(data) : []
}

export const saveTax = (tax: Tax): void => {
  const taxes = getTaxes()
  const index = taxes.findIndex((t) => t.id === tax.id)
  if (index >= 0) {
    taxes[index] = tax
  } else {
    taxes.push(tax)
  }
  localStorage.setItem(STORAGE_KEYS.TAXES, JSON.stringify(taxes))
}

export const deleteTax = (id: string): void => {
  const taxes = getTaxes().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEYS.TAXES, JSON.stringify(taxes))
}

// Obligation Storage
export const getObligations = (): Obligation[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.OBLIGATIONS)
  return data ? JSON.parse(data) : []
}

export const saveObligation = (obligation: Obligation): void => {
  const obligations = getObligations()
  const index = obligations.findIndex((o) => o.id === obligation.id)
  if (index >= 0) {
    obligations[index] = obligation
  } else {
    obligations.push(obligation)
  }
  localStorage.setItem(STORAGE_KEYS.OBLIGATIONS, JSON.stringify(obligations))
}

export const deleteObligation = (id: string): void => {
  const obligations = getObligations().filter((o) => o.id !== id)
  localStorage.setItem(STORAGE_KEYS.OBLIGATIONS, JSON.stringify(obligations))
}

export const getCompletedObligations = (): Obligation[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_OBLIGATIONS)
  return data ? JSON.parse(data) : []
}

export const moveObligationToCompleted = (obligation: Obligation): void => {
  const completed = getCompletedObligations()
  completed.push(obligation)
  localStorage.setItem(STORAGE_KEYS.COMPLETED_OBLIGATIONS, JSON.stringify(completed))
  deleteObligation(obligation.id)
}

// Installment Storage
export const getInstallments = (): Installment[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.INSTALLMENTS)
  return data ? JSON.parse(data) : []
}

export const saveInstallment = (installment: Installment): void => {
  const installments = getInstallments()
  const index = installments.findIndex((i) => i.id === installment.id)
  if (index >= 0) {
    installments[index] = installment
  } else {
    installments.push(installment)
  }
  localStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(installments))
}

export const deleteInstallment = (id: string): void => {
  const installments = getInstallments().filter((i) => i.id !== id)
  localStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(installments))
}

export const getCompletedInstallments = (): Installment[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_INSTALLMENTS)
  return data ? JSON.parse(data) : []
}

export const moveInstallmentToCompleted = (installment: Installment): void => {
  const completed = getCompletedInstallments()
  completed.push(installment)
  localStorage.setItem(STORAGE_KEYS.COMPLETED_INSTALLMENTS, JSON.stringify(completed))
  deleteInstallment(installment.id)
}

// Completed Taxes Storage
export const getCompletedTaxes = (): Tax[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_TAXES)
  return data ? JSON.parse(data) : []
}

export const moveTaxToCompleted = (tax: Tax): void => {
  const completed = getCompletedTaxes()
  completed.push(tax)
  localStorage.setItem(STORAGE_KEYS.COMPLETED_TAXES, JSON.stringify(completed))
  deleteTax(tax.id)
}

// Recurrence Check Tracking
export const getLastRecurrenceCheck = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem(STORAGE_KEYS.LAST_RECURRENCE_CHECK)
}

export const setLastRecurrenceCheck = (date: string): void => {
  localStorage.setItem(STORAGE_KEYS.LAST_RECURRENCE_CHECK, date)
}
