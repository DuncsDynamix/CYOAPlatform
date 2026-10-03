export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** One of the six fixed avatar tones, stable for a given name. */
export function avatarTone(name: string): number {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (hash % 6) + 1
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className={`tg-avatar tg-avatar--${avatarTone(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
