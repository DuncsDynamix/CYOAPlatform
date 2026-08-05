# DIALOGUE Voice Mode — Design

Status: Phase 1 implemented (2026-08-04) — actors speak via ElevenLabs TTS (`lib/voice/tts.ts`, `POST /api/v1/voice/tts`, `useActorVoice` in the dialogue panel; env: `ELEVENLABS_API_KEY`, optional `ELEVENLABS_DEFAULT_VOICE_ID`). Phases 2–3 remain proposals.

## Goal

Let a participant *speak* to a DIALOGUE actor and hear the actor speak back — Margaret at the kitchen table, Sam Okafor on the phone — without changing what the engine is or how it assesses. Voice is the capability gap between Traverse and every commercial roleplay-training competitor (Hyperbound, Second Nature, SimConverse are all voice-first); it matters most in exactly the verticals we are targeting, where tone *is* the competency.

## Governing principle: voice is transport, text is truth

The engine's value lives in text: the scaffold, breakthrough detection, `narrativeHistory`, EVALUATIVE rubric assessment, and the evidence report all consume the dialogue *transcript*. Voice must therefore be a transport layer wrapped around the existing turn loop — never a replacement for it.

Concretely:

- The participant's audio is transcribed to text **before** it enters the engine. `POST /api/v1/engine/dialogue` continues to receive text and remains the single source of truth.
- The actor's reply is generated as text by the existing dialogue path (Claude, queue-wrapped, breakthrough evaluation unchanged), then synthesised to audio for playback.
- The transcript is displayed alongside the audio and stored exactly as today. This is not just accessibility: **the transcript is the audit trail** — the competence-evidence story depends on a reviewable written record, which pure voice products struggle to provide.

This principle also rules an architecture out: realtime speech-to-speech APIs (e.g. OpenAI Realtime-style, where one model handles audio in and audio out) are the lowest-latency option but put a non-Claude model inside the conversational loop. Breakthrough detection, actor ground truth, scripts, and arc awareness would all have to be bolted onto a model we don't prompt-control, and the transcript becomes a lossy byproduct instead of the canonical record. Rejected.

## Architecture options considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Browser-native (Web Speech API) | SpeechRecognition + speechSynthesis, zero server cost | Rejected as primary: recognition quality inconsistent across browsers, robotic TTS destroys the emotional register that motivates voice at all. Acceptable as a degraded fallback. |
| B. Server pipeline: STT → existing dialogue route → TTS | Client streams mic audio to a vendor STT; final transcript posts to the unchanged dialogue endpoint; reply text streams to a vendor TTS; audio streams back | **Recommended.** Engine untouched, text canonical, vendors swappable. |
| C. Realtime speech-to-speech | Single multimodal model handles the audio conversation | Rejected — see governing principle. |

## Recommended design (Option B)

### Turn model: half-duplex, push-to-talk

DIALOGUE is already turn-based with `maxTurns` — voice should match it rather than fight it. The participant holds (or toggles) a talk control, speaks, releases; the actor replies; repeat. No barge-in/interruption in v1. This is a genuine simplification *and* a genuine fit: assessed professional conversations (a press call, a safeguarding chat) tolerate turn-taking far better than casual chat, and it keeps the breakthrough-per-turn evaluation model completely intact.

### Data flow per turn

1. Client captures mic audio (MediaRecorder), streams to STT vendor over WebSocket for live partial transcripts (shown faintly, so the speaker can see they're being understood).
2. On release, the final transcript is shown for a ~2s confirm window (tap to edit — mis-transcription must not become mis-assessment), then POSTs to `/api/v1/engine/dialogue` exactly as typed input does today.
3. The dialogue route runs unchanged: actor reply + breakthrough evaluation.
4. Reply text is chunked at sentence boundaries and streamed to TTS; first audio chunk plays while later ones synthesise. Full text renders progressively alongside.

Latency budget: target < 2s from end-of-speech to first actor audio (STT finalisation ~300ms + generation first-sentence ~800ms + TTS first-chunk ~400ms + transport). Sentence-chunked TTS is the key trick; waiting for the full reply would be 5–8s and feel broken.

### Actor voice profiles

`Actor` (in `ExperienceContextPack` — a JSON field, so **no DB migration**) gains an optional block:

```ts
voice?: {
  vendorVoiceId: string      // e.g. an ElevenLabs voice id
  pace?: "measured" | "normal" | "rapid"
  notes?: string             // delivery guidance, e.g. "tired, guarded, softens late"
}
```

Actors without `voice` fall back to a per-experience default voice; experiences with no voice config behave exactly as today. Margaret and Elaine Hartley should not sound like the same person — casting voices per actor is where the craft shows.

### Vendors

- **STT:** Deepgram (streaming, UK English accuracy, word-level timestamps) or Whisper-large via a hosted API. Behind a thin `lib/voice/stt.ts` interface.
- **TTS:** ElevenLabs or Cartesia for expressive quality; both support streaming synthesis. Behind `lib/voice/tts.ts`.
- Both are config-driven env keys, optional in dev (same posture as Supabase/Upstash/Stripe: no key → voice controls hidden, text mode unaffected). BYOK/operator model extends naturally: voice vendor keys can sit alongside the Anthropic key on the Org.

### Cost (order of magnitude)

A 7-turn dialogue ≈ 3–4 min participant audio + ~600 words synthesised: roughly £0.03–0.05 STT + £0.15–0.30 TTS per dialogue at current list prices — cents per session, negligible against the value story in training, and chargeable within existing tier structure.

### What does NOT change

- `executor.ts`, `session.ts`, scaffolds, EVALUATIVE, arc, router: untouched.
- The dialogue API contract: text in, text out. Voice lives in the client and two thin vendor adapters.
- Non-DIALOGUE nodes: prose stays read. (Optional later: ambient narration TTS — nice, not core.)

## Phasing

1. **Phase 1 — actors speak (TTS only).** Actor replies play as audio with the existing typed input. Small build, disproportionate demo impact: hearing Margaret exist changes the product's felt category. Ships the voice-profile schema and the TTS adapter.
2. **Phase 2 — participant speaks (STT).** Push-to-talk, confirm window, the full pipeline above.
3. **Phase 3 — polish toward real-time.** Barge-in/interruption, auto-endpointing instead of push-to-talk, latency tuning. Only worth it once a vertical demands it (the press-call scenario is where interruption pressure would earn its keep).

## And video?

Assessment, since the question will keep coming: **eventually yes, but it's a checkbox, not a frontier — and the architecture above is deliberately the right substrate for it.**

- What video adds pedagogically is thinner than it looks. Voice carries most of the assessable signal in professional conversation (tone, pace, hesitation, empathy). Video adds nonverbal cues — but an avatar's body language is synthesised, so learners would be reading cues no human produced. For *output* (learner watches actor), it's presence/immersion, real but marginal; for *input* (assessing the learner's own body language on camera), it's a different, heavier product with serious accuracy and fairness risks — not our fight.
- The market will commoditise it. Real-time conversational avatar APIs (Tavus, HeyGen-class) are already consumable services; within a couple of years "talking head on the call" will be a rentable component, and enterprise RFPs will tick-box it. When that day comes, the same text-canonical pipeline drives it: the avatar is just a renderer sitting where the TTS player sits. Voice-as-transport means video-as-transport later, with no engine change.
- Therefore: do not build video; *architect for it* (this design already does) and buy it when a customer makes it a condition. The one cheap exception worth considering earlier: pre-rendered avatar clips for OBSERVED_DIALOGUE nodes, which are non-interactive and could use batch avatar generation for production polish.

## Open questions

- Voice casting workflow: who picks `vendorVoiceId` per actor — authoring UI dropdown with preview, or config-only for now? (Recommend config-only until a paying design partner needs the UI.)
- Whether the confirm-window-before-send survives contact with users, or feels like friction worth removing once STT accuracy is proven on real accents.
- Whether dialogue audio recordings are retained (evidence value) or discarded post-transcription (privacy default). Recommend: discard by default, retain transcript only; make retention an org-level opt-in for verticals that want it.
