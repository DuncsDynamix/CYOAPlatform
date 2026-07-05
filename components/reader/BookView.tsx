"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { BookCover } from "@/components/library/BookCover"
import { Opening } from "@/components/reader/Opening"
import { PageSpread } from "@/components/reader/PageSpread"
import { TurningLeaf } from "@/components/reader/TurningLeaf"
import { ChoiceFoot } from "@/components/reader/ChoiceFoot"
import { MarginInput } from "@/components/reader/MarginInput"
import { OverheardScene } from "@/components/reader/OverheardScene"
import { Colophon } from "@/components/reader/Colophon"
import type { ChoiceOption, Node } from "@/types/experience"
import type { OutcomeCardData, ResolvedContent } from "@/types/engine"

// ─── STATE MACHINE ────────────────────────────────────────────

type BookStatus =
  | { phase: "cover" }
  | { phase: "opening"; sessionId: string; message: string; progress: number }
  | { phase: "prose"; sessionId: string; nodeId: string; content: string; lastChoice: string | null }
  | { phase: "choice"; sessionId: string; nodeId: string; prompt?: string; options: ChoiceOption[]; responseType: "closed" | "open"; openPrompt?: string; lastProse: string; turnKey?: string }
  | { phase: "overheard"; sessionId: string; exchanges: { speaker: string; line: string }[]; openingContext?: string }
  | { phase: "turning"; sessionId: string }
  | { phase: "colophon"; sessionId: string; closingLine: string; summary: string; outcomeCard: OutcomeCardData }
  | { phase: "smudged"; message: string; retryable: boolean; retry?: () => void }
  | { phase: "misbound"; nodeType: string }

interface BookViewProps {
  slug: string
  title: string
  author: string
  genre: string | null | undefined
  coverImageUrl?: string | null
  description?: string | null
  endingsCount: number
}

/** Reads the engine's { error, retryable } envelope off a failed response — mirrors TrainingPlayer. */
async function readFailure(res: Response, fallback: string): Promise<{ message: string; retryable: boolean }> {
  try {
    const body = (await res.json()) as { error?: string; retryable?: boolean }
    return { message: body.error ?? fallback, retryable: body.retryable ?? false }
  } catch {
    return { message: fallback, retryable: false }
  }
}

export function BookView({ slug, title, author, genre, coverImageUrl, description, endingsCount }: BookViewProps) {
  const [status, setStatus] = useState<BookStatus>({ phase: "cover" })
  // A ref (not state) so choose() can update it and have dispatchContent see the
  // fresh value in the very same tick — state would still read stale via the
  // closure captured before the setter took effect.
  const lastChoiceRef = useRef<string | null>(null)

  // The most recent prose content, carried across the turning phase — every
  // fetch transition passes through "turning", so by the time choice content
  // dispatches, prev.phase is no longer "prose" and the prose would be lost.
  const lastProseRef = useRef("")

  // Counts choices made this session, for the verso ribbon's progress estimate.
  // Presentation-only — not part of the state machine.
  const [choicesMade, setChoicesMade] = useState(0)

  // Holds the already-fetched start payload while the opening ritual plays,
  // so onReady can dispatch it without a second network round trip.
  const pendingStartRef = useRef<{ sessionId: string; node: Node; content: ResolvedContent } | null>(null)

  // Guards against a rapid double-click on Begin firing two /engine/start
  // requests (and thus two server sessions). Cleared on failure so retry works.
  const beginningRef = useRef(false)

  // Abort in-flight requests on unmount so late responses can't set state.
  const abortRef = useRef<AbortController | null>(null)

  // ─── Background prefetch (prose → next node) ───────────────────
  // Fired the moment prose content is dispatched, so a Continue click can
  // land instantly instead of paying for a live fetch behind a page-turn.
  //
  // prefetchedRef holds a non-choice result until Continue consumes it.
  // prefetchNodeIdRef guards "one prefetch per node" so re-renders of the
  // same prose page never fire a second request.
  // prefetchAbortRef/PromiseRef track the in-flight request so Continue can
  // await it instead of racing a second, redundant fetch (see continueFromProse).
  const prefetchedRef = useRef<{ node: Node; content: ResolvedContent } | null>(null)
  const prefetchNodeIdRef = useRef<string | null>(null)
  const prefetchAbortRef = useRef<AbortController | null>(null)
  const prefetchPromiseRef = useRef<Promise<"merged" | "stashed" | "failed"> | null>(null)

  // Re-entrancy guard for continueFromProse: a second Continue click while
  // the first is still being serviced (stash consumption, or an awaited
  // in-flight prefetch) must be ignored, or it would fall through to a
  // second live advance() and silently skip a node. Cleared whenever
  // content dispatches, and on advance()'s failure paths so the smudged
  // page's retry still works. prefetchNext also reads it: once Continue
  // has been clicked, a resolving choice prefetch stashes instead of
  // merging, so the settle handler can dispatch it as a normal page turn.
  const continuingRef = useRef(false)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      prefetchAbortRef.current?.abort()
    }
  }, [])

  function nextSignal(): AbortSignal {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    return abortRef.current.signal
  }

  function isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError"
  }

  /**
   * Fires the same GET /engine/node call `advance()` makes, but in the
   * background and without ever entering the "turning" phase — the reader
   * keeps reading the current prose while the next node is fetched.
   *
   * A choice result merges straight onto the page being read (turnKey keeps
   * the recto from remounting, so no page-turn plays). Anything else is
   * stashed for Continue to dispatch synchronously. Failures are silent:
   * Continue simply falls back to a live advance(), same as if there had
   * been no prefetch at all.
   */
  function prefetchNext(sessionId: string, nodeId: string) {
    if (prefetchNodeIdRef.current === nodeId) return // one prefetch per node
    prefetchNodeIdRef.current = nodeId
    prefetchedRef.current = null

    const controller = new AbortController()
    prefetchAbortRef.current = controller

    const promise = (async (): Promise<"merged" | "stashed" | "failed"> => {
      try {
        const res = await fetch(`/api/v1/engine/node?sessionId=${sessionId}`, { signal: controller.signal })
        if (!res.ok) return "failed"
        const data = (await res.json()) as { node: Node; content: ResolvedContent }

        // A choice merges onto the page being read — but only while the
        // reader is still reading it. If Continue has already been clicked
        // (continuingRef), the reader explicitly asked to advance and is
        // watching the turning interstitial, so stash instead: the settle
        // handler in continueFromProse dispatches it as a normal page turn.
        if (data.content.type === "choice" && !continuingRef.current) {
          setStatus((prev) => {
            // Stale if the reader already moved on (e.g. a live advance beat
            // this prefetch, or a new prose page has since been dispatched).
            if (prev.phase !== "prose" || prev.nodeId !== nodeId) return prev
            return {
              phase: "choice",
              sessionId,
              nodeId: data.node.id,
              prompt: data.content.type === "choice" ? data.content.prompt : undefined,
              options: data.content.type === "choice" ? data.content.options : [],
              responseType: (data.node as Extract<Node, { type: "CHOICE" }>).responseType ?? "closed",
              openPrompt: (data.node as Extract<Node, { type: "CHOICE" }>).openPrompt,
              lastProse: lastProseRef.current,
              turnKey: nodeId, // keep the prose page's key — this is not a page-turn
            }
          })
          return "merged"
        }

        prefetchedRef.current = { node: data.node, content: data.content }
        return "stashed"
      } catch {
        return "failed" // covers both network errors and the abort-on-unmount case
      }
    })()

    prefetchPromiseRef.current = promise
    promise.finally(() => {
      if (prefetchAbortRef.current === controller) prefetchAbortRef.current = null
      if (prefetchPromiseRef.current === promise) prefetchPromiseRef.current = null
    })
  }

  const dispatchContent = useCallback((sessionId: string, node: Node, content: ResolvedContent) => {
    continuingRef.current = false // content is landing — Continue may be pressed again
    if (content.type === "prose") {
      lastProseRef.current = content.content
      setStatus({ phase: "prose", sessionId, nodeId: node.id, content: content.content, lastChoice: lastChoiceRef.current })
      prefetchNext(sessionId, node.id)
      return
    }

    if (content.type === "choice") {
      setStatus((prev) => {
        const lastProse = prev.phase === "prose" ? prev.content : prev.phase === "choice" ? prev.lastProse : lastProseRef.current
        return {
          phase: "choice",
          sessionId,
          nodeId: node.id,
          prompt: content.prompt,
          options: content.options,
          responseType: (node as Extract<Node, { type: "CHOICE" }>).responseType ?? "closed",
          openPrompt: (node as Extract<Node, { type: "CHOICE" }>).openPrompt,
          lastProse,
        }
      })
      return
    }

    if (content.type === "checkpoint") {
      if (!content.visible) {
        advance(sessionId)
      } else {
        // Show the checkpoint's content as a normal page; the reader's own
        // Continue button (prose phase) advances past it.
        setStatus({ phase: "prose", sessionId, nodeId: node.id, content: content.content ?? "", lastChoice: lastChoiceRef.current })
      }
      return
    }

    if (content.type === "endpoint") {
      setStatus({ phase: "colophon", sessionId, closingLine: content.closingLine, summary: content.summary, outcomeCard: content.outcomeCard })
      return
    }

    if (content.type === "observed_dialogue") {
      setStatus({ phase: "overheard", sessionId, exchanges: content.exchanges, openingContext: content.openingContext })
      return
    }

    // dialogue | evaluative | slide_deck | not_implemented → this binding doesn't carry those.
    setStatus({ phase: "misbound", nodeType: content.type })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const advance = useCallback(async (sessionId: string) => {
    setStatus({ phase: "turning", sessionId })
    try {
      const res = await fetch(`/api/v1/engine/node?sessionId=${sessionId}`, { signal: nextSignal() })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not turn the page")
        continuingRef.current = false // unblock the smudged page's retry
        setStatus({ phase: "smudged", ...failure, retry: () => advance(sessionId) })
        return
      }
      const data = (await res.json()) as { node: Node; content: ResolvedContent }
      dispatchContent(sessionId, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      continuingRef.current = false // unblock the smudged page's retry
      setStatus({ phase: "smudged", message: "Network error — please try again", retryable: true, retry: () => advance(sessionId) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchContent])

  /**
   * The prose-phase Continue button's handler. Prefers whatever the
   * background prefetch already produced over firing a live request.
   *
   * Race safety: if a prefetch for this node is still in flight, we AWAIT
   * that promise rather than aborting it and firing a second GET — the
   * prefetch is already on the wire, so racing it would only waste a
   * request (and, since the GET advances the server session, could skip a
   * node). While we wait, the "turning" phase shows TurningLeaf's staged
   * messages — this is exactly the long-generation wait they were built
   * for. Because continuingRef is set before the prefetch settles, its
   * choice branch stashes rather than merging (the prose page is gone),
   * and the settle handler here dispatches the result exactly once.
   *
   * Re-entrant clicks are ignored via continuingRef: without it, a second
   * click would attach a second settle handler whose stash read comes up
   * empty and falls through to a live advance(), skipping a node.
   */
  const continueFromProse = useCallback((sessionId: string) => {
    if (continuingRef.current) return
    continuingRef.current = true

    const stashed = prefetchedRef.current
    if (stashed) {
      prefetchedRef.current = null
      dispatchContent(sessionId, stashed.node, stashed.content) // clears continuingRef
      return
    }

    const inFlight = prefetchPromiseRef.current
    if (inFlight) {
      // Cover the wait — the page really is still being written.
      setStatus({ phase: "turning", sessionId })
      inFlight.then((outcome) => {
        const settled = prefetchedRef.current
        if (settled) {
          prefetchedRef.current = null
          dispatchContent(sessionId, settled.node, settled.content) // clears continuingRef
          return
        }
        continuingRef.current = false
        if (outcome === "merged") return // merged before this click was serviced — the choice page is already up
        advance(sessionId) // failed — no prefetch to fall back on
      })
      return
    }

    advance(sessionId) // clears continuingRef via dispatchContent or its failure paths
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchContent, advance])

  const begin = useCallback(async () => {
    // A rapid double-click on Begin must not fire two /engine/start requests
    // (each creates its own server session). Cleared on every failure path
    // so the retry button — which also calls begin() — still works.
    if (beginningRef.current) return
    beginningRef.current = true
    try {
      const res = await fetch("/api/v1/engine/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceSlug: slug }),
        signal: nextSignal(),
      })
      if (!res.ok) {
        beginningRef.current = false
        const failure = await readFailure(res, "Could not open the book")
        setStatus({ phase: "smudged", ...failure, retry: () => begin() })
        return
      }
      const data = (await res.json()) as { sessionId: string; node: Node; content: ResolvedContent; experienceTitle?: string }
      // Mirrors BookReader's old condition for showing the generation ritual:
      // the very first content is GENERATED prose, so its reachable children
      // are still being written server-side when /start returns.
      if (data.content.type === "prose" && data.node.type === "GENERATED") {
        pendingStartRef.current = { sessionId: data.sessionId, node: data.node, content: data.content }
        setStatus({ phase: "opening", sessionId: data.sessionId, message: "Opening the book…", progress: 0 })
      } else {
        dispatchContent(data.sessionId, data.node, data.content)
      }
    } catch (err) {
      beginningRef.current = false
      if (isAbort(err)) return
      setStatus({ phase: "smudged", message: "Network error — please try again", retryable: true, retry: () => begin() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, dispatchContent])

  const handleOpeningReady = useCallback(() => {
    const held = pendingStartRef.current
    pendingStartRef.current = null
    if (held) dispatchContent(held.sessionId, held.node, held.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchContent])

  const choose = useCallback(async (sessionId: string, choiceLabel: string, choiceId?: string, freeText?: string) => {
    setStatus({ phase: "turning", sessionId })
    try {
      const res = await fetch("/api/v1/engine/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, choiceId, freeTextResponse: freeText }),
        signal: nextSignal(),
      })
      if (!res.ok) {
        const failure = await readFailure(res, "Could not turn the page")
        setStatus({ phase: "smudged", ...failure, retry: () => choose(sessionId, choiceLabel, choiceId, freeText) })
        return
      }
      const data = (await res.json()) as { node: Node; content: ResolvedContent }
      lastChoiceRef.current = choiceLabel
      setChoicesMade((n) => n + 1)
      dispatchContent(sessionId, data.node, data.content)
    } catch (err) {
      if (isAbort(err)) return
      setStatus({ phase: "smudged", message: "Network error — please try again", retryable: true, retry: () => choose(sessionId, choiceLabel, choiceId, freeText) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchContent])

  // ─── RENDER ────────────────────────────────────────────────

  // Same rough estimate the old ProgressBar used — 9 choices ≈ a full read.
  const progressPct = Math.min(100, Math.round((choicesMade / 9) * 100))

  if (status.phase === "cover") {
    return (
      <Stage book="cover">
        <div className="lib-cover">
          <BookCover title={title} author={author} genre={genre} coverImageUrl={coverImageUrl} />
        </div>
        <div className="lib-cover-meta">
          <h1>{title}</h1>
          <p className="lib-cover-author">{author}</p>
          {description && <p className="lib-cover-desc">{description}</p>}
          <p className="lib-cover-endings">{endingsCount === 1 ? "A single ending awaits." : `${endingsCount} endings await.`}</p>
          <button className="lib-btn" onClick={begin}>Begin</button>
        </div>
      </Stage>
    )
  }

  if (status.phase === "smudged") {
    return (
      <Stage>
        <div className="lib-error-page">
          <p>The ink has smudged on this page.</p>
          <p>{status.message}</p>
          {status.retryable && status.retry && (
            <button className="lib-btn" onClick={status.retry}>Try the page again</button>
          )}
          <Link href="/" className="lib-btn lib-btn--quiet">Return to the library</Link>
        </div>
      </Stage>
    )
  }

  if (status.phase === "misbound") {
    return (
      <Stage>
        <div className="lib-error-page">
          <p>This page belongs to another binding.</p>
          <Link href="/" className="lib-btn lib-btn--quiet">Return to the library</Link>
        </div>
      </Stage>
    )
  }

  if (status.phase === "colophon") {
    return (
      <Stage>
        <Colophon
          title={title}
          outcomeCard={status.outcomeCard}
          closingLine={status.closingLine}
          summary={status.summary}
          endingsCount={endingsCount}
        />
      </Stage>
    )
  }

  if (status.phase === "opening") {
    return (
      <div className="lib-stage">
        <Opening sessionId={status.sessionId} genre={genre} title={title} author={author} coverImageUrl={coverImageUrl} onReady={handleOpeningReady} />
      </div>
    )
  }

  if (status.phase === "turning") {
    return (
      <Stage>
        <TurningLeaf />
      </Stage>
    )
  }

  if (status.phase === "overheard") {
    return (
      <Stage>
        <OverheardScene
          exchanges={status.exchanges}
          openingContext={status.openingContext}
          onContinue={() => advance(status.sessionId)}
        />
      </Stage>
    )
  }

  if (status.phase === "prose") {
    return (
      <Stage>
        <PageSpread
          prose={status.content}
          nodeId={status.nodeId}
          lastChoice={status.lastChoice}
          progressPct={progressPct}
        >
          <button className="lib-btn lib-btn--quiet lib-continue" onClick={() => continueFromProse(status.sessionId)}>Continue →</button>
        </PageSpread>
      </Stage>
    )
  }

  if (status.phase === "choice") {
    return (
      <Stage>
        <PageSpread
          prose={status.lastProse}
          nodeId={status.nodeId}
          turnKey={status.turnKey}
          lastChoice={lastChoiceRef.current}
          progressPct={progressPct}
        >
          {status.responseType === "open" ? (
            <MarginInput
              prompt={status.prompt ?? status.openPrompt}
              onSubmit={(text) => choose(status.sessionId, text, undefined, text)}
            />
          ) : (
            <ChoiceFoot
              nodeId={status.nodeId}
              prompt={status.prompt}
              options={status.options}
              onChoose={(id, label) => choose(status.sessionId, label, id)}
            />
          )}
        </PageSpread>
      </Stage>
    )
  }

  return null
}

function Stage({ book, children }: { book?: "cover"; children: ReactNode }) {
  return (
    <div className="lib-stage">
      <div className={book ? `lib-book lib-book--${book}` : "lib-book"}>{children}</div>
    </div>
  )
}
