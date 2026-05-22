"use client"

/**
 * UserMenu — Avatar do usuário logado com dropdown (perfil + logout).
 * Quando ninguém está logado, mostra um botão "Entrar".
 *
 * Renderizado no top-bar à direita dos alertas.
 */

import Link from "next/link"
import { LogIn, LogOut, User as UserIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth()

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    )
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5">
          <LogIn className="size-4" />
          <span className="hidden sm:inline">Entrar</span>
        </Button>
      </Link>
    )
  }

  // Iniciais a partir do nome (metadata) ou e-mail
  const fullName = (user.user_metadata?.full_name as string | undefined) || ""
  const displayName = fullName || user.email || "Usuário"
  const initials =
    (fullName
      ? fullName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
      : (user.email || "?").slice(0, 2)
    ).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 px-1.5 gap-2 rounded-full"
          aria-label={`Usuário ${displayName}`}
        >
          <span className="inline-flex items-center justify-center size-7 rounded-full bg-primary/10 text-primary text-[11px] font-bold ring-1 ring-primary/20">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {fullName && (
            <span className="text-[11px] text-muted-foreground truncate font-normal">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="opacity-60">
          <UserIcon className="size-4 mr-2" />
          Meu perfil <span className="ml-auto text-[10px]">(em breve)</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            signOut().catch((e) => console.error("[user-menu] logout falhou:", e))
          }}
          className="text-red-600 focus:text-red-700"
        >
          <LogOut className="size-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
