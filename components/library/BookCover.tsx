import { coverDesign } from "@/lib/library/covers"
import { getHall } from "@/lib/library/halls"

interface BookCoverProps {
  title: string
  author: string
  genre: string | null | undefined
  coverImageUrl?: string | null
  className?: string
}

/** Simple line-wrap for SVG text: split title into <=14-char lines (max 4). */
function wrapTitle(title: string): string[] {
  const words = title.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if ((line + " " + w).trim().length > 14 && line) { lines.push(line); line = w }
    else line = (line + " " + w).trim()
  }
  if (line) lines.push(line)
  if (lines.length > 4) {
    const kept = lines.slice(0, 4)
    kept[3] += "…"
    return kept
  }
  return lines
}

// Ornaments: small inline SVG groups keyed by ornament id. Deliberately
// abstract marks — a laurel arc, an orbit ring, a wax seal disc… — drawn
// with 2 or 3 primitives each so they read at spine size too.
function Ornament({ id, color, y }: { id: string; color: string; y: number }) {
  switch (id) {
    case "orbit": case "lattice": case "beacon":
      return (<g stroke={color} fill="none" strokeWidth="3">
        <circle cx="250" cy={y} r="26" /><circle cx="250" cy={y} r="10" fill={color} stroke="none" />
        <ellipse cx="250" cy={y} rx="44" ry="12" /></g>)
    case "seal": case "eye": case "thorn":
      return (<g><circle cx="250" cy={y} r="24" fill={color} opacity="0.85" />
        <circle cx="250" cy={y} r="24" fill="none" stroke={color} strokeWidth="2" transform={`rotate(8 250 ${y})`} /></g>)
    case "compass": case "summit": case "anchor":
      return (<g stroke={color} strokeWidth="3" fill="none">
        <circle cx="250" cy={y} r="26" /><path d={`M250 ${y - 26} L258 ${y} L250 ${y + 26} L242 ${y} Z`} fill={color} stroke="none" /></g>)
    case "bloom": case "ribbon": case "sparrow":
      return (<g fill={color}><circle cx="238" cy={y} r="9" /><circle cx="262" cy={y} r="9" />
        <circle cx="250" cy={y - 12} r="9" /><circle cx="250" cy={y + 12} r="9" /><circle cx="250" cy={y} r="6" /></g>)
    case "magnifier": case "key": case "monocle":
      return (<g stroke={color} strokeWidth="4" fill="none">
        <circle cx="244" cy={y - 6} r="18" /><line x1="257" y1={`${y + 7}`} x2="272" y2={`${y + 22}`} /></g>)
    default: // laurel, sigil, keystone, rule, fleuron, colophon
      return (<g stroke={color} strokeWidth="3" fill="none">
        <path d={`M210 ${y} Q250 ${y - 30} 290 ${y}`} /><path d={`M218 ${y + 10} Q250 ${y - 14} 282 ${y + 10}`} /></g>)
  }
}

export function BookCover({ title, author, genre, coverImageUrl, className }: BookCoverProps) {
  const design = coverDesign(title, genre)
  const hall = getHall(design.hall)

  if (coverImageUrl) {
    return (
      <div className={className} style={{ position: "relative", background: design.background, borderRadius: "inherit" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverImageUrl} alt={`Cover of ${title}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <span style={{ position: "absolute", inset: 8, border: `1px solid ${design.accent}`, pointerEvents: "none" }} aria-hidden />
        <span style={{ position: "absolute", left: -9999 }}>{title} by {author}</span>
      </div>
    )
  }

  const lines = wrapTitle(title)
  const longest = Math.max(...lines.map((l) => l.length))
  const titleSize = longest > 18 ? 30 : longest > 14 ? 38 : longest > 10 ? 44 : 54
  // Layout variants move the title block / ornament / rules around
  const titleY = [200, 290, 160, 250, 330, 210][design.layout]
  const ornamentY = [470, 150, 500, 480, 170, 520][design.layout]

  return (
    <svg viewBox="0 0 500 760" role="img" aria-label={`Cover of ${title} by ${author}`} className={className} style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="500" height="760" fill={design.background} />
      {/* board texture */}
      <rect width="500" height="760" fill="url(#lib-grain)" opacity="0.05" />
      <defs>
        <pattern id="lib-grain" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="1" height="4" fill="#000" />
        </pattern>
      </defs>
      {/* frame + bantam-style band */}
      <rect x="22" y="22" width="456" height="716" fill="none" stroke={design.accent} strokeWidth="2" />
      <rect x="0" y={design.layout % 2 === 0 ? 60 : 660} width="500" height="18" fill={design.accent} opacity="0.9" />
      <text x="250" y="108" textAnchor="middle" fill={design.foreground} opacity="0.75" fontFamily="'Playfair Display', serif" fontSize="17" letterSpacing="6">{hall.genreLabel.toUpperCase()}</text>
      {lines.map((line, i) => (
        <text key={i} x="250" y={titleY + i * (titleSize + 8)} textAnchor="middle" fill={design.foreground} fontFamily="'Playfair Display', serif" fontWeight="700" fontSize={titleSize}>{line}</text>
      ))}
      <Ornament id={design.ornament} color={design.accent} y={ornamentY} />
      <line x1="150" y1="640" x2="350" y2="640" stroke={design.foreground} strokeWidth="1" opacity="0.5" />
      <text x="250" y="676" textAnchor="middle" fill={design.foreground} fontFamily="'Lora', serif" fontStyle="italic" fontSize="22">{author}</text>
    </svg>
  )
}
