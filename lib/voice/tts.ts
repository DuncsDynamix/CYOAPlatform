import type { ExperienceContextPack } from "@/types/experience"

/**
 * TTS vendor adapter (ElevenLabs). Voice is transport, text is truth:
 * this module synthesises already-generated dialogue text and nothing more.
 * Optional in dev — without ELEVENLABS_API_KEY the feature is silently off,
 * matching the posture of every other external service.
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io"
const MODEL_ID = "eleven_turbo_v2_5"

export function isVoiceEnabled(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY)
}

/**
 * Resolve the vendor voice id for a named actor.
 * Cast voice on the actor wins; otherwise the env default voice; otherwise null.
 * An actor not present in the pack always resolves null — the default is a
 * fallback for uncast actors, not a voice for arbitrary names.
 */
export function resolveActorVoice(
  contextPack: ExperienceContextPack,
  actorName: string
): string | null {
  const actor = contextPack.actors.find((a) => a.name === actorName)
  if (!actor) return null
  return actor.voice?.vendorVoiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || null
}

/** Synthesise speech for one dialogue line. Returns MP3 bytes. */
export async function synthesizeSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error("Voice is not enabled: ELEVENLABS_API_KEY is not set")

  const res = await fetch(
    `${ELEVENLABS_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    }
  )

  if (!res.ok) {
    throw new Error(`TTS synthesis failed: ${res.status} ${await res.text().catch(() => "")}`)
  }

  return res.arrayBuffer()
}
