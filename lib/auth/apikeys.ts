import crypto from "crypto"

// Lazy read: a missing key should produce a clear error on first BYOK use,
// not a cryptic Buffer error (or a crash at import time).
function getEncryptionKey(): string {
  const key = process.env.API_KEY_ENCRYPTION_KEY // 32-byte hex key
  if (!key) throw new Error("API_KEY_ENCRYPTION_KEY is not configured")
  return key
}

export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(getEncryptionKey(), "hex"), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptApiKey(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(getEncryptionKey(), "hex"),
    iv
  )
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
}

export function maskApiKey(plaintext: string): string {
  return `sk-...${plaintext.slice(-4)}`
}
