import type { Metadata, Viewport } from "next"
import Link from "next/link"
import "@/app/globals-library.css"

export const metadata: Metadata = {
  title: "TraverseStories",
  description: "Your story, written as you read it.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TraverseStories",
  },
}

export const viewport: Viewport = {
  themeColor: "#1A1A2E",
}

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="library-theme">
      <header className="lib-header">
        <Link href="/" className="lib-header-wordmark">
          TraverseStories · <em>The Grand Library</em>
        </Link>
        <nav className="lib-header-nav">
          <Link href="/account">Account</Link>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  )
}
