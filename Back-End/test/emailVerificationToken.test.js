import assert from "node:assert/strict"
import test from "node:test"
import {
  createVerificationToken,
  hashVerificationToken,
} from "../utils/emailVerification.js"

test("creates a random token with a SHA-256 hash and 24-hour expiry", () => {
  const start = Date.now()
  const first = createVerificationToken()
  const second = createVerificationToken()
  const finish = Date.now()

  assert.notEqual(first.rawToken, second.rawToken)
  assert.equal(first.tokenHash, hashVerificationToken(first.rawToken))
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/)
  assert.ok(first.expiresAt.getTime() >= start + 24 * 60 * 60 * 1000)
  assert.ok(first.expiresAt.getTime() <= finish + 24 * 60 * 60 * 1000)
})
