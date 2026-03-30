import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth } from "@/lib/auth"
import { CreateExperienceSchema } from "@/lib/validation"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let i = 1
  while (await db.experience.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`
  }
  return slug
}

// GET /api/experience — list all experiences for auth'd user
export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experiences = await db.experience.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      genre: true,
      type: true,
      totalSessions: true,
      totalCompletions: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(experiences)
}

// POST /api/experience — create new experience
export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = CreateExperienceSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, description, genre, type } = parsed.data
  const slug = await uniqueSlug(slugify(title))

  const defaultUseCasePack = USE_CASE_PACKS[type] ?? USE_CASE_PACKS.cyoa_story

  const defaultContextPack = {
    world: { description: "", rules: "", atmosphere: "" },
    actors: [],
    protagonist: { perspective: "you", role: "", knowledge: "", goal: "" },
    style: {
      tone: "",
      language: "en-GB",
      register: "literary",
      targetLength: { min: 150, max: 250 },
      styleNotes: "",
    },
    groundTruth: [],
    scripts: [],
  }

  const defaultShape = {
    totalDepthMin: 6,
    totalDepthMax: 12,
    endpointCount: 3,
    endpoints: [],
    loadBearingChoices: [],
    convergencePoints: [],
    pacingModel: "narrative_arc",
    mandatoryNodeIds: [],
  }

  const experience = await db.experience.create({
    data: {
      authorId: user.id,
      title,
      slug,
      description: description ?? null,
      genre: genre ?? null,
      type,
      useCasePack: defaultUseCasePack as object,
      contextPack: defaultContextPack,
      shape: defaultShape,
      nodes: [],
      segments: [],
    },
  })

  return NextResponse.json(experience, { status: 201 })
}
