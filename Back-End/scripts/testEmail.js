import "dotenv/config"
import { sendEmail } from "../services/emailService.js"

const recipient = process.argv[2]

if (!recipient) {
  console.error("Usage: npm run test:email -- <recipient email>")
  process.exitCode = 1
} else {
  const result = await sendEmail({
    to: recipient,
    subject: "Socialynk email setup test",
    html: "<p>This is a test email from Socialynk.</p>",
  })

  if (!result.success) {
    console.error(result.message)
    process.exitCode = 1
  } else {
    console.log("Test email sent successfully.")
  }
}
