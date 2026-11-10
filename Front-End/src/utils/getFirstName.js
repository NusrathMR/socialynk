export function getFirstName(user) {
  const name = typeof user?.name === "string" ? user.name.trim() : ""
  const nameParts = name.split(/\s+/).filter(Boolean)
  const firstName = nameParts.find((part) => part.length > 1 && !part.endsWith("."))

  if (firstName) return firstName

  const email = typeof user?.email === "string" ? user.email.trim() : ""
  const emailName = email.split("@")[0].replace(/[._\d]+$/, "")

  if (!emailName) return ""

  return emailName.charAt(0).toUpperCase() + emailName.slice(1)
}
