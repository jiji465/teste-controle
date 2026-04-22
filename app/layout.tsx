import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { DataProvider } from "@/contexts/data-context"
import { AutoRecurrenceInitializer } from "@/components/auto-recurrence-initializer"
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
          <AutoRecurrenceInitializer />
          <Suspense fallback={null}>{children}</Suspense>
        </DataProvider>
        <Analytics />
      </body>
    </html>
  )
}
