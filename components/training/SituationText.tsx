import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface SituationTextProps {
  content: string
  isGenerating?: boolean
}

export function SituationText({ content, isGenerating = false }: SituationTextProps) {
  if (isGenerating) {
    return (
      <div className="t-generating" aria-label="Generating scenario…">
        <div className="t-generating-dot" />
        <div className="t-generating-dot" />
        <div className="t-generating-dot" />
      </div>
    )
  }

  return (
    <div className="t-situation">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  )
}
