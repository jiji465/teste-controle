/**
 * Helpers de clima + saudação baseada em horário.
 *
 * - getGreetingMeta(): retorna { greeting, period, gradient } pra o hero.
 * - mapWeatherCode(code, isDay): mapeia código WMO da Open-Meteo pra
 *   { label, iconName } (iconName é resolvido via lucide-react no componente).
 * - fetchOpenMeteo(lat, lon): chama API gratuita sem chave.
 * - fetchReverseGeocode(lat, lon): tenta descobrir nome da cidade.
 * - fetchIPLocation(): fallback se geolocation do browser for negada.
 */

export type DayPeriod = "morning" | "afternoon" | "evening" | "night"

export type GreetingMeta = {
  greeting: string
  period: DayPeriod
  /** Tailwind classes para o gradient de fundo do hero */
  gradient: string
  /** Cor de destaque (ring/text) */
  accent: string
}

export function getGreetingMeta(date: Date = new Date()): GreetingMeta {
  const h = date.getHours()
  if (h >= 5 && h < 12) {
    return {
      greeting: "Bom dia",
      period: "morning",
      gradient: "from-amber-200/40 via-orange-100/30 to-card",
      accent: "text-amber-600 dark:text-amber-400",
    }
  }
  if (h >= 12 && h < 18) {
    return {
      greeting: "Boa tarde",
      period: "afternoon",
      gradient: "from-sky-200/40 via-blue-100/30 to-card",
      accent: "text-sky-600 dark:text-sky-400",
    }
  }
  if (h >= 18 && h < 21) {
    return {
      greeting: "Boa noite",
      period: "evening",
      gradient: "from-orange-200/40 via-pink-100/30 to-card",
      accent: "text-orange-600 dark:text-orange-400",
    }
  }
  return {
    greeting: "Boa noite",
    period: "night",
    gradient: "from-indigo-300/30 via-purple-200/20 to-card",
    accent: "text-indigo-600 dark:text-indigo-400",
  }
}

// ─── Open-Meteo ──────────────────────────────────────────────────────────────

export type WeatherSnapshot = {
  /** Temperatura atual em Celsius */
  temperature: number
  /** Código WMO de tempo */
  weatherCode: number
  /** True se for dia no local (afeta sol/lua e cores) */
  isDay: boolean
}

export async function fetchOpenMeteo(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const c = data?.current
    if (!c || typeof c.temperature_2m !== "number") return null
    return {
      temperature: c.temperature_2m,
      weatherCode: Number(c.weather_code) || 0,
      isDay: Number(c.is_day) === 1,
    }
  } catch {
    return null
  }
}

export type Location = {
  lat: number
  lon: number
  /** Nome amigável (ex: "São Paulo, SP") */
  name?: string
}

export async function fetchReverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    // Open-Meteo geocoding não suporta reverse direto via API estável; usamos
    // BigDataCloud (free, sem chave, suporta CORS).
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const city = data?.city || data?.locality || data?.principalSubdivision
    const region = data?.principalSubdivisionCode?.split("-")?.[1] || data?.principalSubdivision
    if (!city) return null
    return region && region !== city ? `${city}, ${region}` : city
  } catch {
    return null
  }
}

/**
 * Tenta descobrir lat/lon do usuário via geolocation do browser.
 * Resolve null se negado/timeout/erro.
 */
export function getBrowserLocation(timeoutMs = 5000): Promise<Location | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { timeout: timeoutMs, maximumAge: 600_000 }, // cache 10min
    )
  })
}

/** Fallback: tenta geo via IP (precisão de cidade, sem permissão). */
export async function fetchIPLocation(): Promise<Location | null> {
  try {
    const res = await fetch("https://ipapi.co/json/")
    if (!res.ok) return null
    const data = await res.json()
    const lat = Number(data?.latitude)
    const lon = Number(data?.longitude)
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null
    const city = data?.city
    const region = data?.region_code
    return {
      lat,
      lon,
      name: city ? (region ? `${city}, ${region}` : city) : undefined,
    }
  } catch {
    return null
  }
}

// ─── Mapping de código WMO → label + ícone ───────────────────────────────────

export type WeatherKind =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud-moon"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder"

export type WeatherMeta = {
  kind: WeatherKind
  label: string
}

export function mapWeatherCode(code: number, isDay: boolean): WeatherMeta {
  // Códigos WMO: https://open-meteo.com/en/docs#weather_variable_documentation
  if (code === 0) return { kind: isDay ? "sun" : "moon", label: isDay ? "Céu limpo" : "Noite limpa" }
  if (code >= 1 && code <= 3) return { kind: isDay ? "cloud-sun" : "cloud-moon", label: "Parcialmente nublado" }
  if (code === 45 || code === 48) return { kind: "fog", label: "Neblina" }
  if (code >= 51 && code <= 57) return { kind: "drizzle", label: "Garoa" }
  if (code >= 61 && code <= 67) return { kind: "rain", label: "Chovendo" }
  if (code >= 71 && code <= 77) return { kind: "snow", label: "Nevando" }
  if (code >= 80 && code <= 82) return { kind: "rain", label: "Pancadas de chuva" }
  if (code >= 85 && code <= 86) return { kind: "snow", label: "Pancadas de neve" }
  if (code >= 95 && code <= 99) return { kind: "thunder", label: "Trovoada" }
  return { kind: "cloud", label: "Nublado" }
}
