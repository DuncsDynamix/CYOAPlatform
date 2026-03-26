import Link from "next/link"
import { db } from "@/lib/db/prisma"
import { getOverviewStats } from "@/lib/analytics/queries"

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
  const [experiences, stats] = await Promise.all([
    getExperiences(DEV_AUTHOR_ID),
    getOverviewStats(),
  ])

  return (
    <div className="auth-page">
      <div className="auth-page-header">
        <h1 className="auth-page-title">Overview</h1>
        <Link href="/experience/new" className="auth-btn auth-btn--primary">
          + New experience
        </Link>
      </div>

      <div className="console-stat-grid">
        <div className="console-stat-card">
          <div className="console-stat-value">{stats.totalExperiences}</div>
          <div className="console-stat-label">Experiences</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">{stats.totalSessions.toLocaleString()}</div>
          <div className="console-stat-label">Sessions started</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">{stats.totalCompletions.toLocaleString()}</div>
          <div className="console-stat-label">Completions</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">${stats.monthlyCostUSD.toFixed(2)}</div>
          <div className="console-stat-label">AI cost this month</div>
        </div>
      </div>

      <div className="console-section-header">
        <h2 className="console-section-title">Experiences</h2>
        <Link href="/dashboard/experiences" className="auth-btn auth-btn--sm">
          View all →
        </Link>
      </div>

      {experiences.length === 0 ? (
        <div className="auth-empty-state">
          <p>You haven&apos;t created any experiences yet.</p>
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
                <span className={`auth-status-badge auth-status-badge--${exp.status}`}>
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
