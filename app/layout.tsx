import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PageEngine",
  description: "AI-powered interactive narrative platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
