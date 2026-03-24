import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Authoring — Turn To Page",
}

export default function AuthoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <a href="/" className="auth-header-brand">
          Turn To Page
        </a>
        <nav className="auth-header-nav">
          <a href="/dashboard" className="auth-header-link">
            Dashboard
          </a>
          <a href="/account" className="auth-header-link">
            Account
          </a>
        </nav>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  )
}
