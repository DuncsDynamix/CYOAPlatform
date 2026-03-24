import Link from "next/link"
import { db } from "@/lib/db/prisma"

async function getExperiences(authorId: string) {
  return db.experience.findMany({
    where: { authorId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      totalSessions: true,
      totalCompletions: true,
      updatedAt: true,
    },
  })
}

// In dev without auth, use a placeholder authorId so the page renders
const DEV_AUTHOR_ID = "00000000-0000-0000-0000-000000000001"

export default async function DashboardPage() {
  const experiences = await getExperiences(DEV_AUTHOR_ID)

  return (
    <div className="auth-page">
      <div className="auth-page-header">
        <h1 className="auth-page-title">My Experiences</h1>
        <Link href="/experience/new" className="auth-btn auth-btn--primary">
          + New experience
        </Link>
      </div>

      {experiences.length === 0 ? (
        <div className="auth-empty-state">
          <p>You haven't created any experiences yet.</p>
          <Link href="/experience/new" className="auth-btn auth-btn--primary">
            Create your first
          </Link>
        </div>
      ) : (
        <div className="auth-experience-list">
          {experiences.map((exp) => (
            <Link
              key={exp.id}
              href={`/experience/${exp.id}`}
              className="auth-experience-card"
            >
              <div className="auth-experience-card-title">{exp.title}</div>
              <div className="auth-experience-card-meta">
                <span
                  className={`auth-status-badge auth-status-badge--${exp.status}`}
                >
                  {exp.status}
                </span>
                <span className="auth-experience-card-stats">
                  {exp.totalSessions} sessions · {exp.totalCompletions} completions
                </span>
                <span className="auth-experience-card-date">
                  Updated {new Date(exp.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
