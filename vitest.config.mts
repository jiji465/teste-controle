import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Datas do sistema são de calendário brasileiro: roda os testes no fuso
    // de São Paulo pra pegar regressões de UTC (ex.: "2026-02-01" virando janeiro).
    env: { TZ: "America/Sao_Paulo" },
    include: ["**/*.test.{ts,js}"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
