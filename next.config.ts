import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  async redirects() {
    const versionedRoutes = [
      "/api/engine/start",
      "/api/engine/node",
      "/api/engine/choose",
      "/api/engine/dialogue",
      "/api/engine/stream",
      "/api/experience",
      "/api/experience/:id",
      "/api/experience/:id/publish",
      "/api/experience/:id/analytics",
      "/api/analytics",
      "/api/account",
      "/api/stories",
    ]

    return versionedRoutes.map((source) => ({
      source,
      destination: source.replace("/api/", "/api/v1/"),
      permanent: true,
    }))
  },
}

export default nextConfig
