"use client"

import { useState } from "react"
import Link from "next/link"
import type { Node, Segment } from "@/types/experience"
import { validateExperienceGraph } from "@/lib/authoring/graph"
import { looseStitches, type LooseStitch } from "@/lib/library/bindery"
import { normalizeGenre, getHall } from "@/lib/library/halls"
import { BookCover } from "@/components/library/BookCover"
import type { BinderyDraft } from "./Desk"

const LOOSE_INTRO = "the binding is loose on these pages:"
const ADRIFT_INTRO = "No path leads to these pages. Readers will never find them:"
const JAMMED_COPY = "the presses jammed. Try again."

function getSegments(draft: BinderyDraft): Segment[] {
  return Array.isArray(draft.segments) ? (draft.segments as Segment[]) : []
}

function getCoverVariant(draft: BinderyDraft): number {
  return (draft.shape as { coverVariant?: number } | null)?.coverVariant ?? 0
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function asIssueArray(value: unknown): { nodeId: string; handle: string; targetId: string }[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is { nodeId: string; handle: string; targetId: string } =>
      !!v && typeof v === "object" && typeof (v as { nodeId?: unknown }).nodeId === "string"
  )
}

// Sheet 5: the last stop before a book leaves the desk. Shows a live loose-
// stitch report (Task 3/7's validateExperienceGraph + looseStitches) that
// hard-gates the bind button, a "read a proof" link out to the reader, and
// binds by publishing the experience. A server-side rejection (the draft on
// disk can lag the in-memory one by a debounce window) renders through the
// same stitch copy rather than an alert.
export function SheetBind({
  draft,
  onJumpToNode,
  onShelved,
}: {
  draft: BinderyDraft
  onJumpToNode: (nodeId: string) => void
  onShelved: (slug: string) => void
}) {
  const [binding, setBinding] = useState(false)
  const [shelved, setShelved] = useState(false)
  const [serverStitches, setServerStitches] = useState<LooseStitch[] | null>(null)

  const sortedSegments = [...getSegments(draft)].sort((a, b) => a.order - b.order)
  const allNodes: Node[] = sortedSegments.flatMap((s) => s.nodes)
  const validation = validateExperienceGraph(allNodes)
  const stitches = looseStitches(validation, allNodes)

  async function handleBind() {
    setBinding(true)
    setServerStitches(null)
    try {
      const res = await fetch(`/api/v1/experience/${draft.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        const fromServer = looseStitches(
          {
            valid: false,
            startNodeId: null,
            brokenLinks: asIssueArray(data.brokenLinks),
            deadEnds: asStringArray(data.deadEnds),
            unreachable: asStringArray(data.unreachable),
          },
          allNodes
        )
        setServerStitches(
          fromServer.length > 0
            ? fromServer
            : [{ nodeId: "", nodeLabel: "", message: JAMMED_COPY, severity: "blocking" }]
        )
        return
      }
      setShelved(true)
      if (draft.slug) onShelved(draft.slug)
    } finally {
      setBinding(false)
    }
  }

  if (shelved) {
    const hall = getHall(normalizeGenre(draft.genre))
    return (
      <div className="lib-sheet lib-sheet-bind">
        <div className="lib-bound">
          <h2 className="lib-bound-title">It is bound.</h2>
          <p className="lib-bound-sub">Shelved in {hall.roomName}.</p>
          <div className="lib-bound-cover">
            <BookCover
              title={draft.title || "Untitled binding"}
              author="Anonymous"
              genre={draft.genre}
              coverImageUrl={draft.coverImageUrl}
              variant={getCoverVariant(draft)}
            />
          </div>
          <Link href={`/hall/${normalizeGenre(draft.genre)}`} className="lib-bound-walk">
            Walk to the shelf
          </Link>
        </div>
      </div>
    )
  }

  const displayStitches = serverStitches ?? stitches
  const showStitches = displayStitches.length > 0
  const blockingStitches = displayStitches.filter((s) => s.severity === "blocking")
  const adriftStitches = displayStitches.filter((s) => s.severity === "adrift")

  function renderStitchList(list: LooseStitch[]) {
    return (
      <ul>
        {list.map((stitch, i) => (
          <li key={`${i}-${stitch.nodeId}`}>
            {stitch.nodeId ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  onJumpToNode(stitch.nodeId)
                }}
              >
                {stitch.message}
              </a>
            ) : (
              stitch.message
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="lib-sheet lib-sheet-bind">
      <h2>Bind and shelve</h2>

      {showStitches ? (
        <div className="lib-stitches" role={serverStitches ? "alert" : undefined}>
          {blockingStitches.length > 0 && (
            <>
              <p>{LOOSE_INTRO}</p>
              {renderStitchList(blockingStitches)}
            </>
          )}
          {adriftStitches.length > 0 && (
            <>
              <p>{ADRIFT_INTRO}</p>
              {renderStitchList(adriftStitches)}
            </>
          )}
        </div>
      ) : (
        <p className="lib-field-hint">Every thread is tied off. The book is ready to bind.</p>
      )}

      <div className="lib-plan-actions">
        {draft.slug && (
          <a className="lib-btn lib-btn--quiet" href={`/story/${draft.slug}`} target="_blank" rel="noreferrer">
            Read a proof
          </a>
        )}
        <button type="button" className="lib-btn" disabled={!validation.valid || binding} onClick={handleBind}>
          {binding ? "Binding…" : "Bind and shelve this book"}
        </button>
      </div>
    </div>
  )
}
