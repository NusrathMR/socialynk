import { timingSafeEqual } from "node:crypto"
import { sendEmail } from "../services/emailService.js"

function hasValidTestSecret(req) {
  const expectedSecret = process.env.EMAIL_TEST_SECRET
  const authorization = req.get("Authorization") || ""
  const match = authorization.match(/^Bearer\s+(\S+)$/i)

  if (!expectedSecret || !match) {
    return false
  }

  const expected = Buffer.from(expectedSecret)
  const provided = Buffer.from(match[1])

  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function sendTestEmail(req, res) {
  if (!process.env.EMAIL_TEST_SECRET) {
    return res.status(404).json({ message: "Not found." })
  }

  if (!hasValidTestSecret(req)) {
    return res.status(401).json({ message: "Not authorized." })
  }

  const recipient = req.body?.to
  if (typeof recipient !== "string" || !recipient.trim()) {
    return res.status(400).json({ message: "Enter a recipient email address." })
  }

  try {
    const result = await sendEmail({
      to: recipient.trim(),
      subject: "Socialynk email delivery test",
      html: "<p>This is a test email from Socialynk.</p>",
    })

    if (!result.success) {
      return res.status(502).json({ message: result.message })
    }

    return res.status(200).json({ message: "Test email accepted by the mail server." })
  } catch (error) {
    console.error(
      "Test email failed:",
      error instanceof Error ? error.name : "UnexpectedError"
    )
    return res.status(500).json({ message: "Could not send the test email. Check server logs." })
  }
}
