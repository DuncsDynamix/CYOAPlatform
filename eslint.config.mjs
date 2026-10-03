import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const engineEntryOnly = {
  "no-restricted-imports": ["error", {
    patterns: [{
      group: ["@/lib/engine/*", "!@/lib/engine/client"],
      message: "Import from \"@/lib/engine\" (the engine's public entry point), or \"@/lib/engine/client\" from client components.",
    }],
  }],
}

const config = [
  ...nextCoreWebVitals,
  { ignores: [".next/**", "node_modules/**", "public/**", "prisma/migrations/**", "next-env.d.ts"] },
  { files: ["app/**", "components/**", "lib/**"], ignores: ["lib/engine/**"], rules: engineEntryOnly },
  {
    files: ["lib/engine/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/lib/library/*", "@/lib/training/*", "@/components/*", "@/app/*"], message: "The engine must not depend on app layers." }],
      }],
    },
  },
  // pre-existing violations; tighten separately
  {
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]

export default config
