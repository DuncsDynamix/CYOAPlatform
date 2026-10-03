import type { PlayerBrand } from "@/lib/training/views"

/**
 * The org's logo. Inside the player header it collapses to the square mark
 * on phones (shell.css), or to a monogram when the pack has no logo, so the
 * stage line keeps the width.
 */
export function BrandMark({ brand }: { brand: PlayerBrand }) {
  if (!brand.logo) {
    return (
      <span className="tg-brandmark">
        <span className="tg-wordmark">{brand.displayName}</span>
        <span className="tg-monogram" aria-hidden="true">{brand.displayName.trim().charAt(0).toUpperCase()}</span>
      </span>
    )
  }
  return (
    <span className="tg-brandmark">
      <img className="tg-brandmark-full" src={brand.logo.full} alt={brand.displayName} />
      <img className="tg-brandmark-mark" src={brand.logo.mark} alt="" aria-hidden="true" />
    </span>
  )
}
