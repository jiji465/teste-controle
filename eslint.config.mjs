import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts", ".claude/**"],
  },
  {
    rules: {
      // Base legada usa `any` em mapeadores do banco; manter visível sem travar o lint.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Texto em português com aspas/apóstrofos dentro do JSX é intencional.
      "react/no-unescaped-entities": "off",
      // Padrão "isMounted" pra evitar hydration mismatch — revisar aos poucos.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Módulo de apuração portado de outro projeto (JS puro). Fica visível
    // como aviso até ser reescrito em TypeScript.
    files: ["features/apuracao/sete/**"],
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
    },
  },
]

export default config
