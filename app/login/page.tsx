"use client"

/**
 * Página de login/cadastro — Fase 1 do rollout de Auth.
 *
 * Acessível em /login. Usa Supabase Auth (e-mail + senha). Não é obrigatória:
 * o app inteiro continua acessível sem login. Quem entrar aqui ganha uma
 * sessão que será aproveitada quando ligarmos RLS no Supabase (fase 2).
 */

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"

  const [tab, setTab] = useState<"login" | "signup">("login")

  // Estados separados pra cada formulário
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirm, setSignupConfirm] = useState("")
  const [signupName, setSignupName] = useState("")
  const [signupLoading, setSignupLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      toast.error("Informe e-mail e senha.")
      return
    }
    setLoginLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })
      if (error) {
        toast.error(`Login falhou: ${error.message}`)
        return
      }
      toast.success("Login feito.")
      router.push(redirectTo)
      router.refresh()
    } finally {
      setLoginLoading(false)
    }
  }

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    if (!signupEmail || !signupPassword) {
      toast.error("Informe e-mail e senha.")
      return
    }
    if (signupPassword.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (signupPassword !== signupConfirm) {
      toast.error("As senhas não coincidem.")
      return
    }
    setSignupLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          data: { full_name: signupName.trim() || undefined },
          // Redireciona pro callback após confirmar e-mail
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`
              : undefined,
        },
      })
      if (error) {
        toast.error(`Cadastro falhou: ${error.message}`)
        return
      }
      toast.success(
        "Cadastro feito! Verifique seu e-mail pra confirmar antes de entrar.",
        { duration: 6000 },
      )
      setTab("login")
      setLoginEmail(signupEmail.trim())
    } finally {
      setSignupLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5 mr-1" /> Voltar ao sistema
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Controle Fiscal</CardTitle>
            <CardDescription>
              Entre na sua conta ou crie uma nova para proteger seus dados.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Entrando…
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Nome (opcional)</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Senha (mínimo 6 caracteres)</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-confirm">Confirme a senha</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={signupConfirm}
                      onChange={(e) => setSignupConfirm(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={signupLoading}>
                    {signupLoading ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Criando…
                      </>
                    ) : (
                      "Criar conta"
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Você receberá um e-mail pra confirmar antes do primeiro login.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground px-4">
          Por enquanto o login é opcional — o sistema funciona sem ele. Em breve
          ele será obrigatório pra proteger seus dados.
        </p>
      </div>
    </div>
  )
}
