import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { db } from "@/lib/db/prisma"
import { resolveBrand } from "@/lib/branding"
import type { ExperienceContextPack, ShapeDefinition } from "@/types/experience"

// DB-backed page: render per request, never at build time
export const dynamic = "force-dynamic"

/**
 * The org training library: a signed-in learner sees the courses their
 * organisation owns — and only theirs (the multi-tenancy story made visible).
 * Route access itself is enforced by middleware (auth + org membership);
 * this page resolves the user again only to know WHICH org's shelf to show.
 */
async function currentUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Local dev without Supabase: the seeded dev author
    return process.env.NODE_ENV === "production" ? null : "00000000-0000-0000-0000-000000000001"
  }
  const store = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => store.getAll(), setAll() {} } }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

function minutesFor(shape: ShapeDefinition | null): number {
  const steps = shape?.displaySteps ?? shape?.totalDepthMax ?? 0
  return Math.max(10, Math.round((steps * 1.5) / 5) * 5)
}

export default async function TrainingLibraryPage() {
  const userId = await currentUserId()
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { orgId: true, org: { select: { slug: true, name: true } } },
      })
    : null

  if (!user?.orgId) redirect("/login")

  const brand = resolveBrand(user.org?.slug)
  const courses = await db.experience.findMany({
    where: { orgId: user.orgId, renderingTheme: "training", status: "published" },
    orderBy: { createdAt: "asc" },
    select: { slug: true, title: true, description: true, contextPack: true, shape: true },
  })

  return (
    <div
      style={{
        "--t-accent": brand.accent,
        "--t-accent-hover": brand.accentHover,
        "--t-accent-light": brand.accentLight,
      } as React.CSSProperties}
    >
      <div className="t-lib">
        <header className="t-lib-header">
          <div className="t-lib-org">{brand.name}</div>
          <h1 className="t-lib-title">Training Library</h1>
          <p className="t-lib-sub">
            Scenario-based courses built for your organisation. Each one is assessed and
            produces a competence record.
          </p>
        </header>

        {courses.length === 0 ? (
          <p className="t-lib-empty">No courses have been published for your organisation yet.</p>
        ) : (
          <div className="t-lib-grid">
            {courses.map((c) => {
              const cp = c.contextPack as ExperienceContextPack | null
              const objectives = cp?.learningObjectives ?? []
              return (
                <Link key={c.slug} href={`/scenario/${c.slug}`} className="t-lib-card">
                  <h2 className="t-lib-card-title">{c.title}</h2>
                  {c.description && <p className="t-lib-card-desc">{c.description}</p>}
                  <div className="t-lib-card-meta">
                    <span>About {minutesFor(c.shape as ShapeDefinition | null)} minutes</span>
                    {objectives.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {objectives.length} learning objective{objectives.length === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="t-lib-card-cta">Open course</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
