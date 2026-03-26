import "@/app/globals-training.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Training Module",
}

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="training-theme" style={{ minHeight: "100vh", background: "var(--t-bg)" }}>
      {children}
    </div>
  )
}
