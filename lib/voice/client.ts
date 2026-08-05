/**
 * Client-side voice transport. Fetches synthesised audio for one actor line.
 *
 * Result kinds:
 * - "audio"       — playable blob
 * - "disabled"    — voice is off for this session (feature off, or actor uncast);
 *                   callers should stop requesting audio
 * - "unavailable" — transient failure; skip this line, try the next one
 */
export type ActorAudioResult =
  | { kind: "audio"; blob: Blob }
  | { kind: "disabled" }
  | { kind: "unavailable" }

export async function fetchActorAudio(
  sessionId: string,
  actorName: string,
  text: string
): Promise<ActorAudioResult> {
  try {
    const res = await fetch("/api/v1/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, actorName, text }),
    })

    if (res.status === 501 || res.status === 404) return { kind: "disabled" }
    if (!res.ok) return { kind: "unavailable" }

    return { kind: "audio", blob: await res.blob() }
  } catch {
    return { kind: "unavailable" }
  }
}
