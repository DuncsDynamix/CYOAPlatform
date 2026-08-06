/**
 * Demo-mode explainer copy, keyed by the node representation on screen.
 * Audience: a prospect watching or playing a course during a sales demo —
 * capability framing, not authoring documentation (that's
 * lib/help/node-type-help.ts). CHECKPOINT has no entry on purpose: it
 * auto-advances invisibly and never renders a screen.
 */
export const DEMO_NODE_COPY: Record<string, { label: string; blurb: string }> = {
  FIXED: {
    label: "Authored content",
    blurb:
      "This page is fixed, word for word, exactly as the course author wrote it. Every learner sees the identical text — used where precision matters: rules, procedures, factual course material.",
  },
  GENERATED: {
    label: "AI-generated scene",
    blurb:
      "The engine wrote this scene live, following the author's brief but adapting to this learner's earlier decisions. Two learners on different paths read different scenes here — consequences carry forward, so good and bad calls both visibly compound.",
  },
  CHOICE: {
    label: "Decision point",
    blurb:
      "A judgment call with authored options. Each option carries its own coaching feedback and feeds the learner's competency record, so the debrief can point at specific decisions rather than generic scores.",
  },
  CHOICE_OPEN: {
    label: "Open decision",
    blurb:
      "The learner answers in their own words and the engine routes the response to the right branch — no multiple-choice scaffolding, so the course tests recall and judgment, not recognition.",
  },
  SLIDE_DECK: {
    label: "Slide module",
    blurb:
      "Classroom-style course material as a slide carousel — the format for replicating an organisation's existing deck-based training inside the same assessed, recorded experience.",
  },
  DIALOGUE: {
    label: "Live conversation",
    blurb:
      "A free-text conversation with an AI character who stays in role and pushes back realistically. The learner's actual words are retained and assessed — this is where the platform tests how someone holds a line, not just what they know.",
  },
  OBSERVED_DIALOGUE: {
    label: "Observed conversation",
    blurb:
      "The learner watches a modelled conversation between characters — correct practice demonstrated before they have to do it themselves in a live dialogue.",
  },
  EVALUATIVE: {
    label: "AI assessment",
    blurb:
      "A rubric-based assessment of what the learner actually said and chose in the preceding scenes — the engine's narration is excluded as evidence. Each criterion returns a pass with cited evidence from the learner's own words.",
  },
  ENDPOINT: {
    label: "Competence record",
    blurb:
      "The debrief: an AI-written summary of this specific session's decisions, the competency breakdown, and a printable evidence record suitable for a training file.",
  },
}
