import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

/** Author or engine markdown in the training reading style. The only react-markdown call site in the training UI. */
export function Prose({ text }: { text: string }) {
  return (
    <div className="tg-prose">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  )
}
