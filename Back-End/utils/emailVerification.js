import { createHash, randomBytes } from "node:crypto"

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000

export function hashVerificationToken(token) {
  return createHash("sha256").update(token).digest("hex")
}

export function createVerificationToken() {
  const rawToken = randomBytes(32).toString("hex")

  return {
    rawToken,
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
  }
}
