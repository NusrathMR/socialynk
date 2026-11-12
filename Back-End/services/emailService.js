import { Resend } from "resend"
import nodemailer from "nodemailer"

function logEmailError(error, privateValues = []) {
  const valuesToHide = [
    process.env.RESEND_API_KEY,
    process.env.SMTP_PASS,
    process.env.SMTP_USER,
    process.env.EMAIL_TEST_SECRET,
    ...privateValues,
  ].filter(Boolean)

  const redact = (value) => {
    if (typeof value !== "string") {
      return value
    }

    return valuesToHide.reduce(
      (message, privateValue) => message.split(privateValue).join("[redacted]"),
      value
    )
  }

  console.error("Email sending error:", {
    name: redact(error?.name),
    code: redact(error?.code),
    responseCode: error?.responseCode,
    command: redact(error?.command),
    message: redact(error?.message),
  })
}

export async function sendEmail({ to, subject, html, privateValues = [] }) {
  const sender = process.env.EMAIL_FROM
  const provider = process.env.EMAIL_PROVIDER || "gmail"

  if (!sender) {
    console.error("Email configuration is missing EMAIL_FROM.")
    return { success: false, message: "Email sending is not configured." }
  }

  try {
    if (provider === "gmail") {
      const host = process.env.SMTP_HOST
      const port = Number(process.env.SMTP_PORT || 587)
      const user = process.env.SMTP_USER
      const pass = process.env.SMTP_PASS

      if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
        console.error("Gmail SMTP configuration is missing or invalid.")
        return { success: false, message: "Email sending is not configured." }
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      })
      const info = await transporter.sendMail({ from: sender, to, subject, html })

      if (!info.accepted?.length || info.rejected?.length) {
        logEmailError({
          name: "EmailRecipientRejected",
          code: "SMTP_RECIPIENT_REJECTED",
          responseCode: info.responseCode,
          command: info.command,
          message: info.response || "SMTP server did not accept the recipient.",
        }, [...privateValues, to])
        return { success: false, message: "The mail server did not accept the recipient." }
      }

      return { success: true, message: "Email accepted by the mail server.", id: info.messageId }
    }

    if (provider === "resend") {
      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        console.error("Email configuration is missing RESEND_API_KEY.")
        return { success: false, message: "Email sending is not configured." }
      }

      const resend = new Resend(apiKey)
      const { data, error } = await resend.emails.send({
        from: sender,
        to,
        subject,
        html,
      })

      if (error) {
        logEmailError(error, [...privateValues, to])
        return { success: false, message: "Resend could not send the email." }
      }
      if (!data) {
        console.error("Resend did not confirm the email send.")
        return { success: false, message: "Resend did not confirm the email send." }
      }

      return { success: true, message: "Email sent successfully.", id: data.id }
    }

    console.error("Email configuration has an unsupported EMAIL_PROVIDER.")
    return { success: false, message: "Email sending is not configured." }
  } catch (error) {
    logEmailError(error, [...privateValues, to])
    return { success: false, message: "Email could not be sent. Please try again." }
  }
}

export async function sendVerificationEmail(email, token) {
  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl) {
    console.error("Email configuration is missing FRONTEND_URL.")
    return { success: false, message: "Verification link URL is not configured." }
  }

  const verificationUrl =
    `${frontendUrl.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`
  const safeUrl = verificationUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")

  return sendEmail({
    to: email,
    subject: "Verify your Socialynk email",
    html: `
      <h1>Verify your email</h1>
      <p>Click the link below to verify your Socialynk email address.</p>
      <p><a href="${safeUrl}">Verify email</a></p>
    `,
    privateValues: [token],
  })
}
