import { securityHeaders } from "./lib/security-headers.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV !== "production",
        }),
      },
    ]
  },
}

export default nextConfig
