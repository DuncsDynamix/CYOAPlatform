# Library use-case categories + doorstep practice course — design

**Date:** 2026-08-07
**Approved by:** Duncan (grouped sections; four categories; doorstep course fills
practice & rehearsal; theory before conversations)

Demo goal: the Gold Tap Training Library page itself narrates the capability
story for Neil and Kirsty — each course an example of a use case from the
2026-08 refocus (docs/strategy-refocus-2026-08.md paying-verticals table).

## Categories

`UseCaseCategory = "course_replication" | "assessed_training" | "crisis_exercise" | "practice_rehearsal"`,
stored as optional `useCaseCategory` on `ExperienceContextPack`. Display metadata
(title, one-line explainer, order) in `lib/training/use-case-categories.ts`:

1. **Course replication** — "Your existing course, delivered digitally: same
   content, same certificate." → NWH MCQ (0040), NWH Slides (0042)
2. **Assessed interactive training** — "Existing training upgraded with AI
   conversations and rubric assessment: competence proven, not just
   completed." → NWH Interactive (0041), A Day at Lee Valley (0020)
3. **Crisis exercises** — "A live incident simulated under pressure: never the
   same script twice, always an auditable after-action record." → Discoloured (0080)
4. **Practice & rehearsal** — "Repeatable practice between certifications: AI
   role-players and coaching feedback, without certificate pressure." → The
   Doorstep (0090, new)

## Library page

`/scenario` groups courses into titled sections in the order above (empty
sections skipped; uncategorised courses fall back to assessed_training).
Section = heading + explainer line + card grid. Card descriptions rewritten to
one sentence in every seed; CSS clamp tightened to 3 lines. New `t-lib-section*`
styles.

## New course: "The Doorstep: Refusal-of-Entry Practice" (…0090)

`prisma/seed-goldtap-doorstep.ts`, slug `goldtap-doorstep-practice`, Gold Tap
org, published, category practice_rehearsal. Structure (theory feeds the
conversations; Notes drawer gives mid-conversation reference):

- FIXED intro; FIXED theory ×2 (rights of entry, ID and password scheme,
  bogus-caller context, verification routes; then conversation craft:
  purpose-first, acknowledge, choices not ultimatums, vulnerability, the
  withdraw-and-record rule) — checkpoint ticks objective 1.
- GENERATED scene-brief → DIALOGUE **Margaret Hale** (elderly, frightened of
  bogus callers; breakthrough = patient, correct verification, no pressure) →
  GENERATED outcome → checkpoint (objective 2).
- GENERATED scene-brief → DIALOGUE **Dean Currie** (hostile, billing grudge;
  breakthrough = de-escalation, purpose, choices, clean withdrawal if refused)
  → GENERATED outcome → checkpoint (objective 3).
- EVALUATIVE over both dialogues (learner-words-only assessor) with a
  coaching-framed rubric → ENDPOINT debrief (formative summary, no pass mark,
  no certificate language).

Objectives (exact checkpoint strings): (1) "Understand rights of entry, the
identity and password procedure, and why customers are right to be cautious";
(2) "Reassure a frightened customer with patient verification, not persuasion
pressure"; (3) "Stay calm under hostility: de-escalate, offer choices, and
withdraw and record properly when refused". Voices: Margaret = Lily
(pFZP5JQG7iQjIQuC4Bku), Dean = George (JBFqnCBsd6RMkjVDRZzb).
`displaySteps: 10`. World: Medway Water (the fictional utility from
Discoloured) for shelf coherence.

## Out of scope

- Category filtering/URLs, per-category theming, cover-screen category display.
- Porting the ransomware course to Gold Tap (stays Hartley & Voss).

## Verification

Unit: category-grouping helper; categories module completeness. Seed
validation script extended to 0090 (formative endpoint = no scoreConfig, ok
under the usesScore rule). Reseed local + deployed; suite + tsc; deploy; shelf
shows four sections with fitting descriptions.
