export function getGreeting(date = new Date()) {
  const hour = date.getHours()

  if (hour >= 5 && hour <= 11) return "Good morning"
  if (hour >= 12 && hour <= 16) return "Good afternoon"
  if (hour >= 17 && hour <= 21) return "Good evening"
  return "Good night"
}
