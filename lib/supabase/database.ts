/**
 * database.ts — Aggregator for Domain Features
 * 
 * Este arquivo atua como uma fachada (Facade) para manter a compatibilidade
 * retroativa com o DataContext antigo, enquanto a arquitetura migra para o 
 * padrão de Domain-Driven Design (Features).
 */

export * from "@/features/clients/services"
export * from "@/features/taxes/services"
export * from "@/features/obligations/services"
export * from "@/features/installments/services"
export { getLockedPeriods, lockPeriod, unlockPeriod } from "@/lib/storage"
