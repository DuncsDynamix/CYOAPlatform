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
      {content.split("\n\n").map((para, i) => (
        <p key={i} style={{ margin: "0 0 1.1em" }}>{para}</p>
      ))}
    </div>
  )
}
