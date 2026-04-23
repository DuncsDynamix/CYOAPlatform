import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

/**
 * V1: writes to public/uploads/ and serves via Next.js static file serving.
 * Swap this implementation for Vercel Blob / R2 / S3 when the platform is deployed.
 */
export async function uploadImage(file: File): Promise<{ url: string }> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })

  const ext = path.extname(file.name).toLowerCase() || ".bin"
  const filename = `${randomUUID()}${ext}`
  const dest = path.join(uploadsDir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(dest, buffer)

  return { url: `/uploads/${filename}` }
}
