import type { Metadata } from "next"
import type { ResolvedBrandPack } from "./brand-pack"

/** Training pages carry the org's name in the tab and its mark as the favicon. */
export function trainingMetadata(pack: ResolvedBrandPack, title?: string): Metadata {
  return {
    title: title ? `${title} | ${pack.displayName}` : pack.displayName,
    ...(pack.logo && { icons: { icon: pack.logo.mark } }),
  }
}
