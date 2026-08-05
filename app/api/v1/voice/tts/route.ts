import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/engine/session"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { isVoiceEnabled, resolveActorVoice, synthesizeSpeech } from "@/lib/voice/tts"
import type { ExperienceContextPack } from "@/types/experience"

const TtsRequestSchema = z.object({
  sessionId: z.string().uuid(),
  actorName: z.string().min(1).max(200),
  text: z.string().min(1).max(1200),
})

/**
 * POST /api/v1/voice/tts
 * Synthesises one actor dialogue line to audio (Phase 1: actors speak).
 * Session-scoped: the caller must be able to access the session, and the
 * actor must exist in the session's experience with a resolvable voice.
 * Voice is transport — nothing here touches dialogue state or assessment.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = TtsRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  if (!isVoiceEnabled()) {
    return NextResponse.json({ error: "Voice is not enabled" }, { status: 501 })
  }

  const { sessionId, actorName, text } = parsed.data

  const user = await requireAuth(req, { allowAnonymous: true })
  const session = await getSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!(await canAccessSession(user?.id ?? null, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 })
  }

  const contextPack = experience.contextPack as unknown as ExperienceContextPack
  const voiceId = resolveActorVoice(contextPack, actorName)
  if (!voiceId) {
    return NextResponse.json({ error: "No voice available for this actor" }, { status: 404 })
  }

  try {
    const audio = await synthesizeSpeech(text, voiceId)
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[voice/tts] synthesis failed:", e)
    return NextResponse.json({ error: "Synthesis failed" }, { status: 502 })
  }
}
