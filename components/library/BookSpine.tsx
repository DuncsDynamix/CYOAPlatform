import { spineDesign } from "@/lib/library/covers"

interface BookSpineProps {
  title: string
  author: string
  genre: string | null | undefined
}

const MAX_SPINE_CHARS = 26

/** Shelf rendering of a book — same seed as its cover. Decorative only;
 *  the wrapping link carries the accessible name. */
export function BookSpine({ title, author, genre }: BookSpineProps) {
  const design = spineDesign(title, genre)
  const label = title.length > MAX_SPINE_CHARS ? `${title.slice(0, MAX_SPINE_CHARS - 1)}…` : title

  return (
    <svg viewBox="0 0 44 170" aria-hidden="true">
      <rect width="44" height="170" rx="2" fill={design.background} />
      <rect x="3" y="6" width="38" height="3" fill={design.accent} opacity="0.9" />
      <rect x="3" y="161" width="38" height="3" fill={design.accent} opacity="0.9" />
      <text
        x="22" y="14"
        transform="rotate(90 22 14)"
        fill={design.foreground}
        fontFamily="'Playfair Display', serif"
        fontSize="11"
        letterSpacing="0.5"
      >
        {label}
      </text>
      <circle cx="22" cy="148" r="5" fill={design.accent} opacity="0.85" />
      <title>{`${title} by ${author}`}</title>
    </svg>
  )
}
