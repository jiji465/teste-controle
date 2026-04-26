"use client"

import { useEffect, useState } from "react"
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  MapPin,
  Loader2,
  Sunset,
  Sunrise,
} from "lucide-react"
import {
  fetchIPLocation,
  fetchOpenMeteo,
  fetchReverseGeocode,
  getBrowserLocation,
  getGreetingMeta,
  mapWeatherCode,
  type WeatherKind,
  type WeatherSnapshot,
} from "@/lib/weather"

const WEATHER_ICON: Record<WeatherKind, typeof Sun> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
}

/** Ícone do horário pra usar como "decoração" mesmo sem dados de tempo */
function PeriodIcon({ period, className }: { period: ReturnType<typeof getGreetingMeta>["period"]; className?: string }) {
  if (period === "morning") return <Sunrise className={className} />
  if (period === "afternoon") return <Sun className={className} />
  if (period === "evening") return <Sunset className={className} />
  return <Moon className={className} />
}

type WeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; weather: WeatherSnapshot; cityName: string | null }
  | { status: "denied" }
  | { status: "error" }

/**
 * Widget compacto que mostra:
 *  - Ícone grande adaptado ao horário (e ao tempo, se permitido)
 *  - Temperatura atual + cidade + condição (se permitido)
 *
 * Tenta:
 *  1. Geolocation do browser (silencioso — só pede uma vez)
 *  2. Fallback via IP (sem permissão, precisão de cidade)
 *  3. Falha gracioso: só mostra ícone do horário
 */
export function WeatherGreeting({ accent }: { accent: string }) {
  const [state, setState] = useState<WeatherState>({ status: "idle" })
  const period = getGreetingMeta().period

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState({ status: "loading" })
      // 1. Tenta browser geolocation primeiro
      let loc = await getBrowserLocation()
      // 2. Fallback IP
      if (!loc) loc = await fetchIPLocation()

      if (!loc) {
        if (!cancelled) setState({ status: "error" })
        return
      }

      const [weather, geocoded] = await Promise.all([
        fetchOpenMeteo(loc.lat, loc.lon),
        loc.name ? Promise.resolve(loc.name) : fetchReverseGeocode(loc.lat, loc.lon),
      ])

      if (cancelled) return
      if (!weather) {
        setState({ status: "error" })
        return
      }
      setState({ status: "ready", weather, cityName: geocoded ?? loc.name ?? null })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────
  if (state.status === "loading") {
    return (
      <div className={`shrink-0 flex items-center gap-3 rounded-xl bg-background/40 px-4 py-3 backdrop-blur-sm border border-border/50 min-w-[180px]`}>
        <Loader2 className={`size-8 animate-spin ${accent}`} />
        <div className="space-y-1">
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          <div className="h-2 w-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // Sem dados — só ícone decorativo grande do horário
  if (state.status !== "ready") {
    return (
      <div className="shrink-0 flex items-center gap-3 rounded-xl bg-background/40 px-4 py-3 backdrop-blur-sm border border-border/50">
        <PeriodIcon period={period} className={`size-10 ${accent}`} />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {period === "morning"
              ? "Manhã"
              : period === "afternoon"
                ? "Tarde"
                : period === "evening"
                  ? "Entardecer"
                  : "Noite"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Ative a localização pra ver o tempo
          </p>
        </div>
      </div>
    )
  }

  // Com dados completos
  const meta = mapWeatherCode(state.weather.weatherCode, state.weather.isDay)
  const Icon = WEATHER_ICON[meta.kind]
  const temp = Math.round(state.weather.temperature)

  return (
    <div className="shrink-0 flex items-center gap-3 rounded-xl bg-background/50 px-4 py-3 backdrop-blur-sm border border-border/50 hover:shadow-md transition-shadow min-w-[200px]">
      <div className={`flex items-center justify-center size-12 rounded-lg ${accent.replace("text-", "bg-").replace("dark:text-", "dark:bg-").replace("-600", "-500/15").replace("-400", "-400/15")}`}>
        <Icon className={`size-7 ${accent}`} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold tabular-nums leading-none ${accent}`}>{temp}°</span>
          <span className="text-xs text-muted-foreground">C</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{meta.label}</p>
        {state.cityName && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            <MapPin className="size-2.5" />
            <span className="truncate max-w-[140px]">{state.cityName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
