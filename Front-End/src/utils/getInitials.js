function getInitials(name) {
  if (typeof name !== "string" || !name.trim()) return "U"

  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 1) {
    return words[0][0].toUpperCase()
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export default getInitials
