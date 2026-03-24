import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Turn To Page",
  description: "Choose your own adventure for grown-ups",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Turn To Page",
  },
}

export const viewport: Viewport = {
  themeColor: "#1A1A2E",
}

export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--colour-page)",
      }}
    >
      {/* Minimal nav */}
      <header
        style={{
          borderBottom: "1px solid var(--colour-border)",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "680px",
          margin: "0 auto",
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--colour-text-primary)",
            textDecoration: "none",
            letterSpacing: "0.05em",
          }}
        >
          Turn To Page
        </a>
        <a
          href="/account"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--colour-text-muted)",
            textDecoration: "none",
          }}
        >
          Account
        </a>
      </header>

      <main>{children}</main>
    </div>
  )
}
