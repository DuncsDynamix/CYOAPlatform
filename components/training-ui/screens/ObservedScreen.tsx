"use client"

import { useState } from "react"
import { toDisplayText } from "@/lib/training/display"
import { Avatar } from "../Avatar"
import { Footer, Screen, ScreenBody } from "../Screen"

/** A modelled conversation the learner reads, one line at a time. */
export function ObservedScreen({
  exchanges,
  openingContext,
  onContinue,
}: {
  exchanges: { speaker: string; line: string }[]
  openingContext?: string
  onContinue: () => void
}) {
  const [revealed, setRevealed] = useState(1)
  const complete = revealed >= exchanges.length
  const speakerA = exchanges[0]?.speaker ?? ""

  return (
    <Screen>
      <ScreenBody>
        <p className="tg-kicker">Observe</p>
        {openingContext && <p className="tg-observe-context">{openingContext}</p>}
        <ol className="tg-observe">
          {exchanges.slice(0, revealed).map((x, i) => (
            <li key={i} className={x.speaker === speakerA ? "tg-observe-row" : "tg-observe-row tg-observe-row--b"}>
              <Avatar name={x.speaker} />
              <div className="tg-observe-bubble">
                <span className="tg-observe-speaker">{toDisplayText(x.speaker)}</span>
                <p>{x.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </ScreenBody>
      <Footer>
        {complete ? (
          <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onContinue}>
            Continue
          </button>
        ) : (
          <button type="button" className="tg-btn tg-btn--secondary tg-btn--block" onClick={() => setRevealed((r) => r + 1)}>
            Next
          </button>
        )}
      </Footer>
    </Screen>
  )
}
