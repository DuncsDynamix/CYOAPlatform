/**
 * Per-org white-label theming (config-level; DB-backed branding is a
 * scale-up item). Keyed by Org.slug. Applied as --t- token overrides in
 * the training player, so one config entry rebrands the whole surface.
 */
export interface BrandTheme {
  name: string
  accent: string
  accentHover: string
  accentLight: string
}

export const DEFAULT_BRAND: BrandTheme = {
  name: "TraverseTraining",
  accent: "#185FA5",
  accentHover: "#134E8A",
  accentLight: "#E6F1FB",
}

const BRANDS: Record<string, BrandTheme> = {
  "gold-tap-training": {
    name: "Gold Tap Training",
    accent: "#8A6D1D",
    accentHover: "#6F5717",
    accentLight: "#F6EFD9",
  },
  "fernbrook-care": {
    name: "Fernbrook Care",
    accent: "#2E6E4E",
    accentHover: "#245A3F",
    accentLight: "#E4F2EA",
  },
  "hartley-voss": {
    name: "Hartley & Voss",
    accent: "#43506B",
    accentHover: "#364058",
    accentLight: "#E8EBF2",
  },
}

export function resolveBrand(orgSlug: string | null | undefined): BrandTheme {
  if (!orgSlug) return DEFAULT_BRAND
  return BRANDS[orgSlug] ?? DEFAULT_BRAND
}
