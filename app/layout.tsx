import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Suspense } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { DataProvider } from "@/contexts/data-context"
import { PeriodProvider } from "@/contexts/period-context"
import { AutoRecurrenceInitializer } from "@/components/auto-recurrence-initializer"
import { ErrorBoundary } from "@/components/error-boundary"
import { AppShell } from "@/components/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import "./globals.css"

// Corpo + títulos: Inter (fonte da identidade de referência)
const fontSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

// Números/mono: Geist Mono (tabular-nums em valores)
const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Sistema Fiscal - Controle de Obrigações",
  description: "Sistema de controle de obrigações acessórias e impostos para contabilidade",
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthProvider>
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
          </AuthProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
