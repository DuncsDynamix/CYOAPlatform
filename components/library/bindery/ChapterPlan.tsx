"use client"

import type { EndpointNode, Node, Segment } from "@/types/experience"
import type { BinderyPack } from "@/lib/library/bindery-packs"
import { derivePlan, makeBinderyChoice, makeBinderyEnding, makeBinderyPage, type PlanRow } from "@/lib/library/bindery"
import { PageCard } from "./PageCard"
import { ChoiceCard } from "./ChoiceCard"

type TurnToCandidate = { id: string; label: string; chapter: string }

// Sheet 4b's centrepiece: the flat, readable plan for one chapter. Chapters
// ARE segments — this reads segment.nodes through derivePlan (Task 3) so the
// plan's row order always matches the reader's actual path through the
// chapter, not authoring/array order.
export function ChapterPlan({
  segment,
  allNodes,
  segments,
  pack,
  onNodesChange,
  onDraftChapter,
  onDraftPage,
  onSample,
}: {
  segment: Segment
  allNodes: Node[]
  /** Every chapter in the book, in reading order — used to build "Turn to..." candidates from the current chapter and its neighbours. */
  segments: Segment[]
  pack: BinderyPack
  onNodesChange: (nodes: Node[]) => void
  onDraftChapter: () => void
  onDraftPage: (nodeId: string) => void
  onSample: (nodeId: string) => Promise<string>
}) {
  const rows = derivePlan(segment.nodes, allNodes)

  function turnToCandidatesFor(excludeId: string): TurnToCandidate[] {
    const sorted = [...segments].sort((a, b) => a.order - b.order)
    const currentIndex = sorted.findIndex((s) => s.id === segment.id)
    const neighbourhood =
      currentIndex === -1 ? [segment] : sorted.filter((_, i) => Math.abs(i - currentIndex) <= 1)
    const candidates: TurnToCandidate[] = []
    for (const chapter of neighbourhood) {
      for (const node of chapter.nodes) {
        if (node.id === excludeId) continue
        candidates.push({ id: node.id, label: node.label || "(untitled)", chapter: chapter.label })
      }
    }
    return candidates
  }

  function updateNode(updated: Node) {
    onNodesChange(segment.nodes.map((n) => (n.id === updated.id ? updated : n)))
  }

  function addPage() {
    onNodesChange([...segment.nodes, makeBinderyPage("written")])
  }

  function addChoice() {
    onNodesChange([...segment.nodes, makeBinderyChoice()])
  }

  function addEnding() {
    onNodesChange([...segment.nodes, makeBinderyEnding("")])
  }

  function kindLabel(row: PlanRow): string {
    switch (row.kind) {
      case "page":
        return row.mode === "written" ? pack.vocabulary.pageWritten : pack.vocabulary.pageTold
      case "choice":
        return pack.vocabulary.choice
      case "ending":
        return pack.vocabulary.ending
      case "other":
        return "bound in the Studio"
    }
  }

  return (
    <div className="lib-plan">
      {rows.map((row) => (
        <div key={row.node.id}>
          {row.isRejoin && <p className="lib-plan-rejoin">paths rejoin here</p>}
          <div
            id={`plan-row-${row.node.id}`}
            tabIndex={-1}
            className={
              row.kind === "choice"
                ? "lib-plan-row lib-plan-row--choice"
                : row.kind === "ending"
                  ? "lib-plan-row lib-plan-row--ending"
                  : "lib-plan-row"
            }
          >
            <span className="lib-plan-kind">{kindLabel(row)}</span>

            {row.kind === "page" && (
              <PageCard
                node={row.node as Extract<Node, { type: "FIXED" | "GENERATED" }>}
                vocabulary={pack.vocabulary}
                targets={row.targets}
                turnToCandidates={turnToCandidatesFor(row.node.id)}
                onChange={updateNode}
                onDraft={() => onDraftPage(row.node.id)}
                onSample={row.mode === "told" ? () => onSample(row.node.id) : undefined}
              />
            )}

            {row.kind === "choice" && (
              <ChoiceCard
                node={row.node as Extract<Node, { type: "CHOICE" }>}
                targets={row.targets}
                turnToCandidates={turnToCandidatesFor(row.node.id)}
                onChange={updateNode}
              />
            )}

            {row.kind === "ending" && (
              <EndingRow node={row.node as EndpointNode} onChange={updateNode} />
            )}

            {row.kind === "other" && (
              <p className="lib-field-hint">
                {row.node.label ? `'${row.node.label}' is` : "This page is"} bound in the Studio.
              </p>
            )}
          </div>
        </div>
      ))}

      <div className="lib-plan-actions">
        {segment.nodes.length === 0 && (
          <button type="button" className="lib-btn" onClick={onDraftChapter}>
            Draft this chapter
          </button>
        )}
        <button type="button" className="lib-btn lib-btn--quiet" onClick={addPage}>
          Add a page
        </button>
        <button type="button" className="lib-btn lib-btn--quiet" onClick={addChoice}>
          Add a decision
        </button>
        <button type="button" className="lib-btn lib-btn--quiet" onClick={addEnding}>
          Add a closing page
        </button>
      </div>
    </div>
  )
}

// The "ending card variant of PageCard" — an EndpointNode has no "told/written"
// mode and no outgoing link, so it edits a name (for the author's own
// reference) and the closing line the reader sees.
function EndingRow({ node, onChange }: { node: EndpointNode; onChange: (node: EndpointNode) => void }) {
  return (
    <>
      <div className="lib-field">
        <label htmlFor={`bindery-ending-label-${node.id}`}>Ending name</label>
        <input
          id={`bindery-ending-label-${node.id}`}
          value={node.label}
          onChange={(e) => onChange({ ...node, label: e.target.value, outcomeLabel: e.target.value })}
        />
      </div>
      <div className="lib-field">
        <label htmlFor={`bindery-ending-closing-${node.id}`}>Closing line</label>
        <textarea
          id={`bindery-ending-closing-${node.id}`}
          value={node.closingLine}
          onChange={(e) => onChange({ ...node, closingLine: e.target.value })}
        />
      </div>
    </>
  )
}
