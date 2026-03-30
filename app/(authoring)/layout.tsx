import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TraverseStudio",
}

export default function AuthoringLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <a href="/" className="auth-header-brand">
          TraverseStudio
        </a>
        <nav className="auth-header-nav">
          <a href="/dashboard" className="auth-header-link">
            Overview
          </a>
          <a href="/dashboard/experiences" className="auth-header-link">
            Experiences
          </a>
          <a href="/dashboard/costs" className="auth-header-link">
            Costs
          </a>
          <a href="/dashboard/sessions" className="auth-header-link">
            Sessions
          </a>
        </nav>
      </header>
      <main className="auth-main">{children}</main>
    </div>
  )
}
