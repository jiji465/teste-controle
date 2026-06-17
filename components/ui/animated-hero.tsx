"use client"

/**
 * AnimatedHero — título com palavras rotativas (framer-motion).
 *
 * Adaptado do componente original de landing para o contexto deste painel:
 *  - vira um Client Component ("use client") porque usa useState/useEffect;
 *  - cores saem dos tokens shadcn (a cor `text-spektr-cyan-50` do original
 *    não existe aqui) — a palavra que entra/sai recebe um gradiente
 *    primary → chart-2;
 *  - textos e CTAs são parametrizáveis (props) com defaults em pt-BR, então
 *    o mesmo componente serve de banner no Dashboard e em outras telas.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Typewriter } from "@/components/ui/typewriter"

interface AnimatedHeroProps {
  /** Texto fixo antes da palavra rotativa. */
  staticText?: string
  /** Palavras que entram/saem em loop. */
  rotatingWords?: string[]
  /** Parágrafo de apoio (passe "" para esconder). */
  description?: string
  /** Selo/badge acima do título. */
  badge?: ReactNode
  /** Ações (botões/links) abaixo do texto. */
  actions?: ReactNode
  /** Alinhamento do conteúdo. */
  align?: "center" | "left"
  /** Densidade vertical. "inline" zera o padding (p/ aninhar dentro de outro card). */
  size?: "compact" | "full" | "inline"
  /** Intervalo entre as palavras (ms). */
  interval?: number
  /** Usa efeito de digitação (typewriter) na palavra dinâmica, em vez do slide. */
  typewriter?: boolean
  /** Classe(s) da palavra dinâmica (default: gradiente primary→chart-2). */
  wordClassName?: string
  /** Classe(s) do cursor do typewriter. */
  cursorClassName?: string
  className?: string
}

const DEFAULT_WORDS = ["em dia", "organizado", "sob controle", "sem atrasos", "previsível"]

export function AnimatedHero({
  staticText = "Seu controle fiscal está",
  rotatingWords = DEFAULT_WORDS,
  description = "Obrigações, guias, parcelamentos e serviços de todos os clientes num só lugar — com prazos calculados automaticamente e alertas do que vence primeiro.",
  badge,
  actions,
  align = "center",
  size = "full",
  interval = 2200,
  typewriter = false,
  wordClassName = "bg-gradient-to-r from-primary to-chart-2 bg-clip-text font-bold text-transparent",
  cursorClassName = "ml-0.5 text-primary",
  className,
}: AnimatedHeroProps) {
  const [index, setIndex] = useState(0)
  const words = useMemo(() => rotatingWords, [rotatingWords])

  useEffect(() => {
    const id = setTimeout(() => {
      setIndex((prev) => (prev === words.length - 1 ? 0 : prev + 1))
    }, interval)
    return () => clearTimeout(id)
  }, [index, words, interval])

  const isLeft = align === "left"

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex flex-col",
          size === "inline" ? "gap-4" : "gap-6",
          size === "full" ? "py-16 lg:py-24" : size === "compact" ? "py-7 lg:py-9" : "py-0",
          isLeft ? "items-start text-left" : "items-center justify-center text-center",
        )}
      >
        {badge}

        <div className="flex flex-col gap-3">
          <h1
            className={cn(
              "max-w-3xl font-semibold tracking-tighter text-balance",
              size === "full" ? "text-4xl md:text-6xl" : "text-3xl md:text-4xl",
              isLeft ? "" : "mx-auto",
            )}
          >
            {typewriter ? (
              <span className={cn("block", isLeft ? "text-left" : "text-center")}>
                <span className="text-foreground">{staticText} </span>
                <Typewriter
                  text={words}
                  speed={65}
                  deleteSpeed={35}
                  waitTime={1800}
                  className={wordClassName}
                  cursorChar="_"
                  cursorClassName={cursorClassName}
                />
              </span>
            ) : (
              <>
                <span className="text-foreground">{staticText}</span>
                <span
                  className={cn(
                    "relative flex w-full overflow-hidden pb-2 pt-1 md:pb-3",
                    isLeft ? "justify-start text-left" : "justify-center text-center",
                  )}
                >
                  &nbsp;
                  {words.map((word, i) => (
                    <motion.span
                      key={i}
                      className={cn("absolute", wordClassName, isLeft && "left-0")}
                      initial={{ opacity: 0, y: -100 }}
                      transition={{ type: "spring", stiffness: 50 }}
                      animate={
                        index === i
                          ? { y: 0, opacity: 1 }
                          : { y: index > i ? -150 : 150, opacity: 0 }
                      }
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
              </>
            )}
          </h1>

          {description ? (
            <p
              className={cn(
                "max-w-2xl text-base leading-relaxed tracking-tight text-muted-foreground md:text-lg",
                isLeft ? "" : "mx-auto",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-row flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  )
}

// Alias compatível com o nome `Hero` do snippet original.
export { AnimatedHero as Hero }
