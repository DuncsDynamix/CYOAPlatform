import type { ReactNode } from "react"

/**
 * Screen scaffolding. The shell's main area is the one scroll container; a
 * screen's footer sticks to its bottom, so Continue is always in reach.
 */
export function Screen({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div className="tg-screen" aria-busy={busy || undefined}>
      {children}
    </div>
  )
}

export function ScreenBody({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "tg-screen-body" : "tg-screen-body tg-read"}>{children}</div>
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="tg-footer">
      <div className="tg-footer-inner">{children}</div>
    </div>
  )
}
