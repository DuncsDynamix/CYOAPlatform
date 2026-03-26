import { getRecentSessions } from "@/lib/analytics/queries"

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function SessionsPage() {
  const sessions = await getRecentSessions(null, 50)

  const total = sessions.length
  const completed = sessions.filter((s) => s.completed).length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="auth-page auth-page--wide">
      <div className="auth-page-header">
        <h1 className="auth-page-title">Sessions</h1>
        <span className="console-period-badge">Most recent 50</span>
      </div>

      <div className="console-stat-grid">
        <div className="console-stat-card">
          <div className="console-stat-value">{total}</div>
          <div className="console-stat-label">Sessions shown</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">{completed}</div>
          <div className="console-stat-label">Completed</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">{completionRate}%</div>
          <div className="console-stat-label">Completion rate</div>
        </div>
      </div>

      <div className="console-card">
        {sessions.length === 0 ? (
          <p className="auth-empty">No sessions recorded yet.</p>
        ) : (
          <table className="console-table console-table--full">
            <thead>
              <tr>
                <th>Started</th>
                <th>Experience</th>
                <th className="console-table-num">Choices</th>
                <th>Endpoint</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.sessionId}>
                  <td className="console-table-mono">{formatDate(s.startedAt)}</td>
                  <td>{s.experienceTitle ?? <span className="console-muted">—</span>}</td>
                  <td className="console-table-num">
                    {s.choicesMade != null ? s.choicesMade : <span className="console-muted">—</span>}
                  </td>
                  <td>
                    {s.endpointId ? (
                      <span className="console-endpoint-label">{s.endpointId}</span>
                    ) : (
                      <span className="console-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`auth-status-badge auth-status-badge--${s.completed ? "published" : "draft"}`}>
                      {s.completed ? "completed" : "in progress"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
