// Deterministic cover & decoration design. Same book, same cover, forever.
import { normalizeGenre, getHall, type HallId } from "./halls"

/** FNV-1a 32-bit — stable across runs and platforms. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export interface CoverDesign {
  hall: HallId
  layout: 0 | 1 | 2 | 3 | 4 | 5
  background: string
  foreground: string
  accent: string
  ornament: string
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function coverDesign(title: string, genre: string | null | undefined): CoverDesign {
  const hallId = normalizeGenre(genre)
  const hall = getHall(hallId)
  const seed = hashSeed(`${title}::${hallId}`)

  const background = hall.spinePalette[seed % hall.spinePalette.length]
  const layout = ((seed >>> 3) % 6) as CoverDesign["layout"]
  const ornament = hall.ornaments[(seed >>> 7) % hall.ornaments.length]
  const accent = hall.glow
  const foreground = luminance(background) > 0.45 ? hall.ink : "#F5F0E8"

  return { hall: hallId, layout, background, foreground, accent, ornament }
}

/** Decorative page number: odd, 11..197, stable per node. Pure atmosphere. */
export function decorativePageNumber(nodeId: string): number {
  const n = 11 + (hashSeed(nodeId) % 94) * 2 // 11,13,…,197
  return n
}

/** "Turn to page N →" per option — stable, distinct between options. */
export function turnToPageNumber(nodeId: string, optionId: string): number {
  return 11 + (hashSeed(`${nodeId}::${optionId}`) % 94) * 2
}

export interface SpineDesign {
  hall: HallId
  background: string
  foreground: string
  accent: string
  ornament: string
  widthStep: 0 | 1 | 2 | 3
  heightStep: 0 | 1 | 2
  lean: -1 | 0 | 1
}

/** Spine rendering of the same seed as the cover — one book, one design. */
export function spineDesign(title: string, genre: string | null | undefined): SpineDesign {
  const cover = coverDesign(title, genre)
  const seed = hashSeed(`${title}::${cover.hall}`)

  const widthStep = ((seed >>> 11) % 4) as SpineDesign["widthStep"]
  const heightStep = ((seed >>> 13) % 3) as SpineDesign["heightStep"]
  // ~70% stand straight: 0..9 → 0..6 straight, 7,8 lean left/right
  const leanRoll = (seed >>> 15) % 10
  const lean = (leanRoll === 7 ? -1 : leanRoll === 8 ? 1 : 0) as SpineDesign["lean"]

  return {
    hall: cover.hall,
    background: cover.background,
    foreground: cover.foreground,
    accent: cover.accent,
    ornament: cover.ornament,
    widthStep,
    heightStep,
    lean,
  }
}
