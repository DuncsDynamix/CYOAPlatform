"use client"

import { useState } from "react"
import type { NodeLayout } from "@/types/experience"
import { Prose } from "../Prose"
import { Footer, Screen, ScreenBody } from "../Screen"
import { LayoutView } from "../layouts/LayoutView"

/** FIXED and GENERATED scenes: prose on a paper card (or the node's layout template), sticky Continue. */
export function SceneScreen({
  title,
  content,
  layout,
  onContinue,
}: {
  title?: string
  content: string
  layout?: NodeLayout
  onContinue: () => void
}) {
  const [continued, setContinued] = useState(false)
  const showTitle = Boolean(title) && !/^\s*#/.test(content)

  return (
    <Screen>
      <ScreenBody>
        {layout && layout.template !== "text-only" ? (
          <LayoutView layout={layout} fallbackContent={content} />
        ) : (
          <article className="tg-paper">
            {showTitle && <h1 className="tg-paper-title">{title}</h1>}
            <Prose text={content} />
          </article>
        )}
      </ScreenBody>
      <Footer>
        <button
          type="button"
          className="tg-btn tg-btn--primary tg-btn--block"
          disabled={continued}
          onClick={() => {
            setContinued(true)
            onContinue()
          }}
        >
          Continue
        </button>
      </Footer>
    </Screen>
  )
}
