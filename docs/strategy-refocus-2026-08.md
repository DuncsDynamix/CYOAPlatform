# Strategy Refocus — August 2026

One page. The decisions, not the analysis. Context: solo founder, no deployment yet,
one warm channel (Gold Tap Training). Supersedes the multi-vertical framing in the
platform roadmap for commercial purposes; the architecture is unchanged.

## What the customer is paying for

**Confidence backed by a record.** In every vertical that pays, the playable scenario
is the *means*; the purchased thing is the **evidence**: a dated, rubric-based record
that a named person demonstrated a competency under realistic pressure.

| Vertical | Buyer | What they're buying | Evidence role |
|----------|-------|--------------------|---------------|
| Regulated training (care, utilities, finance) | Training/compliance manager | Proof of staff competence for an inspector, insurer, or tribunal | The product |
| Crisis exercises (cyber, comms, continuity) | Ops/security lead, driven by insurers | Demonstrable preparedness at ~1/10 of a consultant day, repeatable quarterly | The product (after-action report) |
| Clinical-adjacent education (vet, teaching, pharmacy) | Course leader | Practice capacity human role-players can't provide affordably | Formative |
| Consumer fiction | — | Nobody pays meaningfully | None — which is why |

Differentiators that competitors (voice-first chat roleplay; static branching tools)
cannot follow: authored structure with guaranteed decision points; rubric assessment
against buyer-supplied ground truth; **same rubric, never the same script** (generated
variation defeats answer-sharing and makes reassessment cycles real).

## Decisions

1. **Training is the only funded surface.** The library and Bindery are frozen as a
   craft showcase — no further design or feature investment.
2. **The evidence report becomes a first-class artefact.** EVALUATIVE output rendered
   as a dated, forwardable document (the thing a compliance officer files). This is
   the highest-leverage build item on the platform.
3. **One player gets the design investment: the training player.** Finish the deferred
   `TraversePlayer` (tt- components), with the debrief/evidence screen as centrepiece.
   In a founder-led sale, the demo is the product.
4. **The engine stays in this repo.** Decoupling is enforced by module boundaries
   (`lib/engine/` + use-case packs), optionally hardened with an ESLint import rule.
   Extraction trigger: a second real consumer asks for it. Not before.
5. **Route to profit: services-led through Gold Tap.** Bespoke scenario packs for
   their clients, priced per engagement (low £000s) plus per-learner platform fee.
   Productise into per-seat pricing only after 2–3 engagements show which vertical
   pulls hardest. No consumer, no self-serve authoring for strangers, no marketplace.

## Next 90 days

1. Evidence report artefact (design + implementation). This subsumes the
   "certification tracking + audit export" blocker from the April 2026 Gold Tap
   roadmap — one artefact serves both.
2. Training player rebuild; debrief screen first.
3. Demo pack: Fernbrook safeguarding + Hartley & Voss ransomware seeds, voice on
   (ElevenLabs Starter tier + TTS opening-line cache).
4. Gold Tap discovery conversation (see `docs/goldtap-discovery-questions.md`),
   then co-specced pilot scenario for one of their real clients, charged.

**Open questions the discovery conversation must settle** (April 2026 flagged org
branding and SCORM/LMS export as blocking Gold Tap sales — test, don't assume):
whether a pilot can ship as a branded web link without SCORM (deciding if export
blocks the pilot or only the scale-up), and whether scenario evidence must attach
to a formal certification (NWH/SHEA) to be credible or can stand alone.

## The artefact chain (implemented August 2026)

The evidence story is now three layers, all on the session record:
1. **Evidence Record** (debrief screen, printable) — the verdict: rubric
   outcomes with quoted evidence.
2. **Dialogue transcripts** — retained verbatim; EVALUATIVE assesses the
   learner's actual words.
3. **Session record** (`GET /api/v1/engine/record?sessionId=`) — the case
   file: every scene, decision and conversation in visit order, plus the
   assessment and closing summary. Machine-readable JSON first — the future
   learner-profile context ("this learner previously…") derives from it.

Identity binding (records → named employees) lands with the auth story.
Org-level retention policy becomes a real feature at the same point (a
per-employee performance record is HR personal data).

## Parked — with re-entry triggers

| Parked item | Re-enter when |
|-------------|---------------|
| Stories / Bindery investment | Training revenue funds it, or a publisher asks |
| Engine extraction to separate repo/SDK | A second real consumer requests integration |
| Education / publisher_ip packs | A named buyer appears |
| Voice Phase 2–3 (STT input, streaming) | A pilot customer asks for spoken input |
| Video avatars | An enterprise RFP demands it (buy, don't build) |
| Self-hosted TTS (Chatterbox) | Deployment exists + per-minute costs matter at scale |
