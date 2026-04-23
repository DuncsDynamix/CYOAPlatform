import type { NodeLayout, Slide } from "@/types/experience"
import { TextOnly } from "./templates/TextOnly"
import { Title } from "./templates/Title"
import { ImageLeft } from "./templates/ImageLeft"
import { ImageRight } from "./templates/ImageRight"
import { FullBleed } from "./templates/FullBleed"
import { Quote } from "./templates/Quote"
import { DiagramWithCallouts } from "./templates/DiagramWithCallouts"

interface LayoutRendererProps {
  layout: NodeLayout | Slide
  /** Fallback prose rendered when template is text-only or layout is absent */
  fallbackContent?: string
}

export function LayoutRenderer({ layout, fallbackContent }: LayoutRendererProps) {
  const { template } = layout
  const mediaUrl = layout.mediaUrl
  const caption = layout.caption
  const callouts = "callouts" in layout ? layout.callouts : undefined
  const title = "title" in layout ? layout.title : undefined
  const body = "body" in layout ? layout.body : fallbackContent

  switch (template) {
    case "text-only":
      return <TextOnly title={title} body={body ?? fallbackContent} />
    case "title":
      return <Title title={title} body={body} />
    case "image-left":
      return <ImageLeft title={title} body={body} mediaUrl={mediaUrl} caption={caption} />
    case "image-right":
      return <ImageRight title={title} body={body} mediaUrl={mediaUrl} caption={caption} />
    case "full-bleed":
      return <FullBleed title={title} body={body} mediaUrl={mediaUrl} caption={caption} />
    case "quote":
      return <Quote body={body} title={title} />
    case "diagram-with-callouts":
      return <DiagramWithCallouts title={title} mediaUrl={mediaUrl} caption={caption} callouts={callouts} />
  }
}
