import "@/app/globals-traverse-training.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TraverseTraining",
}

export default function TraverseTrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="traverse-training-theme tt-shell">
      {children}
    </div>
  )
}
