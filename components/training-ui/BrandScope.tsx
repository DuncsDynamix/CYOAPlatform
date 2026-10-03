import type { CSSProperties, ReactNode } from "react"
import { brandTokens, type ResolvedBrandPack } from "@/lib/training/brand-pack"

/**
 * Applies an org's resolved brand pack as --tg-* custom properties. Wraps
 * the library (learner's org), the scenario page and the record page
 * (experience's org). The font variables it points at are defined on the
 * training layout (app/(traverse-training)/fonts.ts).
 */
export function BrandScope({ pack, children }: { pack: ResolvedBrandPack; children: ReactNode }) {
  return (
    <div className="tg-scope" data-header={pack.colours.header} style={brandTokens(pack) as CSSProperties}>
      {children}
    </div>
  )
}
