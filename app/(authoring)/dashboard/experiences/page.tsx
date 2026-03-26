import Link from "next/link"
import { db } from "@/lib/db/prisma"

const DEV_AUTHOR_ID = "00000000-0000-0000-0000-000000000001"

async function getExperiences() {
  return db.experience.findMany({
    where: { authorId: DEV_AUTHOR_ID },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      type: true,
      totalSessions: true,
      totalCompletions: true,
      updatedAt: true,
    },
  })
}

export default async function ExperiencesPage() {
  const experiences = await getExperiences()

  return (
    <div className="auth-page">
      <div className="auth-page-header">
        <h1 className="auth-page-title">Experiences</h1>
        <Link href="/experience/new" className="auth-btn auth-btn--primary">
          + New experience
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
        <div className="console-card">
          <table className="console-table console-table--full">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th className="console-table-num">Sessions</th>
                <th className="console-table-num">Completions</th>
                <th className="console-table-num">Rate</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {experiences.map((exp) => {
                const rate =
                  exp.totalSessions > 0
                    ? Math.round((exp.totalCompletions / exp.totalSessions) * 100)
                    : 0
                return (
                  <tr key={exp.id}>
                    <td>
                      <Link href={`/experience/${exp.id}`} className="console-link">
                        {exp.title}
                      </Link>
                    </td>
                    <td className="console-muted">{exp.type}</td>
                    <td>
                      <span className={`auth-status-badge auth-status-badge--${exp.status}`}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="console-table-num">{exp.totalSessions}</td>
                    <td className="console-table-num">{exp.totalCompletions}</td>
                    <td className="console-table-num">{rate}%</td>
                    <td className="console-muted">
                      {new Date(exp.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
