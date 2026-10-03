import "@/components/training-ui/styles/tokens.css"
import "@/components/training-ui/styles/base.css"
import "@/components/training-ui/styles/shell.css"
import "@/components/training-ui/styles/scene.css"
import "@/components/training-ui/styles/slides.css"
import "@/components/training-ui/styles/states.css"
import "@/components/training-ui/styles/decision.css"
import "@/components/training-ui/styles/conversation.css"
import "@/components/training-ui/styles/assessment.css"
import "@/components/training-ui/styles/debrief.css"
import "@/components/training-ui/styles/cover.css"
import "@/components/training-ui/styles/library.css"
import "@/components/training-ui/styles/record.css"
import type { Metadata } from "next"
import { fontVariables } from "./fonts"

export const metadata: Metadata = {
  title: "Training",
}

// The font variables sit on the layout so every training page can resolve
// --tg-ff-*; BrandScope (per page) picks which two the pack uses.
export default function TraverseTrainingLayout({ children }: { children: React.ReactNode }) {
  return <div className={fontVariables}>{children}</div>
}
