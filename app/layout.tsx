import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Suspense } from "react"
import { DataProvider } from "@/contexts/data-context"
import { PeriodProvider } from "@/contexts/period-context"
import { AutoRecurrenceInitializer } from "@/components/auto-recurrence-initializer"
import { ErrorBoundary } from "@/components/error-boundary"
import { AppShell } from "@/components/app-shell"
import { Toaster } from "sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Sistema Fiscal - Controle de Obrigações",
  description: "Sistema de controle de obrigações acessórias e impostos para contabilidade",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <DataProvider>
          <PeriodProvider>
            <AutoRecurrenceInitializer />
            <ErrorBoundary>
              <Suspense fallback={null}>
                <AppShell>{children}</AppShell>
              </Suspense>
            </ErrorBoundary>
          </PeriodProvider>
        </DataProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
