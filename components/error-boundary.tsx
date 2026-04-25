"use client"

import { Component, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {this.state.error?.message || "Ocorreu um erro inesperado. Tente recarregar a página."}
            </p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="size-4 mr-2" />
            Recarregar página
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
