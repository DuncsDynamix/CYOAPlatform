import { PrismaClient } from "@prisma/client"
import { validateConfig } from "@/lib/config"

// Every server module imports the db — validating here means a production
// boot with missing env vars fails before serving a single request.
validateConfig()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
