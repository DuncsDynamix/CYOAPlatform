import { z } from "zod"

/**
 * Per-org white-label brand pack (Org.brandPack). Packs vary identity,
 * colour, fonts and imagery only; layout, spacing, type scale and the
 * assessment status colours are platform-fixed and have no field here, so no
 * brand can make "Not assessed" read as a pass.
 */

export const FONT_KEYS = ["montserrat", "open-sans", "inter", "source-serif-4", "lato", "nunito-sans"] as const
export type FontKey = (typeof FONT_KEYS)[number]

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #RRGGBB colour")

export const BrandPackSchema = z.object({
  displayName: z.string().min(1).max(80),
  logo: z
    .object({ onLight: z.string().min(1), onDark: z.string().min(1), mark: z.string().min(1) })
    .optional(),
  colours: z.object({
    brand: Hex,
    brandInk: Hex.optional(),
    onBrand: Hex,
    header: z.enum(["dark", "light"]),
    surfaceTone: z.enum(["warm", "cool", "neutral"]),
  }),
  fonts: z.object({ heading: z.enum(FONT_KEYS), body: z.enum(FONT_KEYS) }),
  imagery: z
    .object({ hero: z.string().min(1).optional(), courseFallback: z.string().min(1).optional() })
    .optional(),
  recordPrefix: z.string().regex(/^[A-Z]{2,4}$/).optional(),
})
export type BrandPack = z.infer<typeof BrandPackSchema>

export interface ResolvedBrandPack extends Omit<BrandPack, "colours"> {
  colours: BrandPack["colours"] & { brandInk: string }
  isDefault: boolean
}

export const NEUTRALS = {
  warm: { surface: "#F7F4EE", raised: "#FFFFFF", border: "#E5DFD2", text: "#1F2124", muted: "#5D6168" },
  cool: { surface: "#F3F5F8", raised: "#FFFFFF", border: "#DDE2E8", text: "#1C2430", muted: "#5A6472" },
  neutral: { surface: "#F5F5F5", raised: "#FFFFFF", border: "#E0E0E0", text: "#1F1F1F", muted: "#5E5E5E" },
} as const

export const HEADER_COLOURS = {
  dark: { bg: "#1F2124", fg: "#FFFFFF", muted: "#C9CBD0", control: "#34373C" },
  light: { bg: "#FFFFFF", fg: "#1F2124", muted: "#5D6168", control: "#F1F2F4" },
} as const

export const MIN_CONTRAST = 4.5

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase()
}

/** Darkens `brand` toward black until it reads at MIN_CONTRAST on `surface`. */
export function deriveInk(brand: string, surface: string): string {
  if (contrastRatio(brand, surface) >= MIN_CONTRAST) return brand
  const base = channels(brand)
  for (let t = 0.04; t <= 1; t += 0.04) {
    const candidate = toHex(base.map((c) => c * (1 - t)))
    if (contrastRatio(candidate, surface) >= MIN_CONTRAST) return candidate
  }
  return "#000000"
}

/** Contrast failures, as plain sentences. Empty means the pack is usable as-is. */
export function brandPackIssues(pack: BrandPack): string[] {
  const surface = NEUTRALS[pack.colours.surfaceTone].surface
  const issues: string[] = []
  if (contrastRatio(pack.colours.onBrand, pack.colours.brand) < MIN_CONTRAST) {
    issues.push("Text on the brand colour (onBrand) is below 4.5:1 contrast.")
  }
  if (pack.colours.brandInk && contrastRatio(pack.colours.brandInk, surface) < MIN_CONTRAST) {
    issues.push("Brand ink is below 4.5:1 contrast on the page surface.")
  }
  return issues
}

const DEFAULT_COLOURS = { brand: "#3E5C76", onBrand: "#FFFFFF" }

export function defaultBrandPack(orgName: string): ResolvedBrandPack {
  return {
    displayName: orgName,
    colours: {
      ...DEFAULT_COLOURS,
      brandInk: deriveInk(DEFAULT_COLOURS.brand, NEUTRALS.cool.surface),
      header: "dark",
      surfaceTone: "cool",
    },
    fonts: { heading: "inter", body: "inter" },
    isDefault: true,
  }
}

export function resolveBrandPack(org: { name: string; brandPack: unknown } | null | undefined): ResolvedBrandPack {
  const orgName = org?.name ?? "Training"
  if (!org || org.brandPack === null || org.brandPack === undefined) return defaultBrandPack(orgName)

  const parsed = BrandPackSchema.safeParse(org.brandPack)
  if (!parsed.success) {
    console.warn(`[brand-pack] invalid pack for "${orgName}", using default:`, parsed.error.issues[0]?.message)
    return defaultBrandPack(orgName)
  }

  const pack = parsed.data
  const surface = NEUTRALS[pack.colours.surfaceTone].surface
  let { brand, onBrand } = pack.colours
  if (contrastRatio(onBrand, brand) < MIN_CONTRAST) {
    console.warn(`[brand-pack] "${orgName}" onBrand/brand contrast too low, using default pair`)
    brand = DEFAULT_COLOURS.brand
    onBrand = DEFAULT_COLOURS.onBrand
  }
  let brandInk = pack.colours.brandInk ?? deriveInk(brand, surface)
  if (contrastRatio(brandInk, surface) < MIN_CONTRAST) {
    console.warn(`[brand-pack] "${orgName}" brandInk contrast too low, deriving`)
    brandInk = deriveInk(brand, surface)
  }

  return { ...pack, colours: { ...pack.colours, brand, onBrand, brandInk }, isDefault: false }
}

export function brandTokens(pack: ResolvedBrandPack): Record<string, string> {
  const neutral = NEUTRALS[pack.colours.surfaceTone]
  const header = HEADER_COLOURS[pack.colours.header]
  const font = (key: FontKey) => `var(--tg-ff-${key}), system-ui, sans-serif`
  return {
    "--tg-brand": pack.colours.brand,
    "--tg-brand-ink": pack.colours.brandInk,
    "--tg-on-brand": pack.colours.onBrand,
    "--tg-header-bg": header.bg,
    "--tg-header-fg": header.fg,
    "--tg-header-muted": header.muted,
    "--tg-header-control": header.control,
    "--tg-surface": neutral.surface,
    "--tg-surface-raised": neutral.raised,
    "--tg-border": neutral.border,
    "--tg-text": neutral.text,
    "--tg-text-muted": neutral.muted,
    "--tg-font-heading": font(pack.fonts.heading),
    "--tg-font-body": font(pack.fonts.body),
  }
}
