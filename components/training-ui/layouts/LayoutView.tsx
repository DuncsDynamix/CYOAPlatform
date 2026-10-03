import type { Callout, NodeLayout, Slide } from "@/types/experience"
import { Prose } from "../Prose"

/**
 * The seven presentation templates for FIXED/GENERATED layouts and slides,
 * in the training reading style. Images are always <img> elements: author
 * paths never reach a CSS url().
 */

interface Parts {
  title?: string
  body?: string
  mediaUrl?: string
  caption?: string
  callouts?: Callout[]
}

function Media({ mediaUrl, caption, title }: Parts) {
  if (!mediaUrl) return null
  return (
    <figure className="tg-layout-media">
      <img className="tg-layout-img" src={mediaUrl} alt={caption ?? title ?? ""} />
      {caption && <figcaption className="tg-layout-caption">{caption}</figcaption>}
    </figure>
  )
}

function TextOnly({ title, body }: Parts) {
  return (
    <div className="tg-layout tg-layout--text-only">
      {title && <h2 className="tg-layout-title">{title}</h2>}
      {body && <Prose text={body} />}
    </div>
  )
}

function TitleHero({ title, body }: Parts) {
  return (
    <div className="tg-layout tg-layout--title">
      {title && <h1 className="tg-layout-hero-title">{title}</h1>}
      {body && (
        <div className="tg-layout-hero-sub">
          <Prose text={body} />
        </div>
      )}
    </div>
  )
}

function ImageSide({ side, ...parts }: Parts & { side: "left" | "right" }) {
  return (
    <div className={side === "left" ? "tg-layout tg-layout--image-left" : "tg-layout tg-layout--image-right"}>
      <Media {...parts} />
      <div className="tg-layout-text">
        {parts.title && <h2 className="tg-layout-title">{parts.title}</h2>}
        {parts.body && <Prose text={parts.body} />}
      </div>
    </div>
  )
}

function FullBleed({ title, body, mediaUrl, caption }: Parts) {
  return (
    <div className="tg-layout tg-layout--full-bleed">
      {mediaUrl && <img className="tg-layout-bleed-img" src={mediaUrl} alt="" />}
      <div className="tg-layout-bleed-overlay">
        {title && <h2 className="tg-layout-bleed-title">{title}</h2>}
        {body && <Prose text={body} />}
        {caption && <p className="tg-layout-caption tg-layout-caption--inverse">{caption}</p>}
      </div>
    </div>
  )
}

function QuoteBlock({ title, body }: Parts) {
  return (
    <figure className="tg-layout tg-layout--quote">
      {body && <blockquote className="tg-layout-quote">{body}</blockquote>}
      {title && <figcaption className="tg-layout-quote-by">{title}</figcaption>}
    </figure>
  )
}

function Diagram({ title, mediaUrl, caption, callouts = [] }: Parts) {
  return (
    <div className="tg-layout tg-layout--diagram">
      {title && <h2 className="tg-layout-title">{title}</h2>}
      {mediaUrl && (
        <div className="tg-layout-diagram">
          <img className="tg-layout-img" src={mediaUrl} alt={caption ?? title ?? ""} />
          {callouts.map((c, i) => (
            <div key={i} className="tg-callout" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} title={c.detail}>
              <span className="tg-callout-marker">{i + 1}</span>
              <span className="tg-callout-label">{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {caption && <p className="tg-layout-caption">{caption}</p>}
      {callouts.length > 0 && (
        <ol className="tg-callout-list">
          {callouts.map((c, i) => (
            <li key={i}>
              <strong>{c.label}</strong>
              {c.detail && `: ${c.detail}`}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function LayoutView({ layout, fallbackContent }: { layout: NodeLayout | Slide; fallbackContent?: string }) {
  const parts: Parts = {
    title: "title" in layout ? layout.title : undefined,
    body: "body" in layout && layout.body !== undefined ? layout.body : fallbackContent,
    mediaUrl: layout.mediaUrl,
    caption: layout.caption,
    callouts: layout.callouts,
  }
  switch (layout.template) {
    case "title":
      return <TitleHero {...parts} />
    case "image-left":
      return <ImageSide side="left" {...parts} />
    case "image-right":
      return <ImageSide side="right" {...parts} />
    case "full-bleed":
      return <FullBleed {...parts} />
    case "quote":
      return <QuoteBlock {...parts} />
    case "diagram-with-callouts":
      return <Diagram {...parts} />
    default:
      return <TextOnly {...parts} />
  }
}
