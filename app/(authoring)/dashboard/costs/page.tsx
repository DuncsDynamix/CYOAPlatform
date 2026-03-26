import { getCostsByExperience, getCostsByModel, getDailyCosts, getGenerationCosts } from "@/lib/analytics/queries"

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01"
  return `$${usd.toFixed(4)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export default async function CostsPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [monthly, byExperience, byModel, dailyCosts] = await Promise.all([
    getGenerationCosts(monthStart, now),
    getCostsByExperience(thirtyDaysAgo, now),
    getCostsByModel(thirtyDaysAgo, now),
    getDailyCosts(30),
  ])

  const maxDailyCost = Math.max(...dailyCosts.map((d) => d.costUSD), 0.0001)

  return (
    <div className="auth-page auth-page--wide">
      <div className="auth-page-header">
        <h1 className="auth-page-title">AI Costs</h1>
        <span className="console-period-badge">Last 30 days</span>
      </div>

      {/* Headline */}
      <div className="console-stat-grid">
        <div className="console-stat-card">
          <div className="console-stat-value">${monthly.estimatedCostUSD.toFixed(4)}</div>
          <div className="console-stat-label">Month to date</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">{monthly.totalRequests.toLocaleString()}</div>
          <div className="console-stat-label">API calls this month</div>
        </div>
        <div className="console-stat-card">
          <div className="console-stat-value">{formatTokens(monthly.totalInputTokens + monthly.totalOutputTokens)}</div>
          <div className="console-stat-label">Total tokens this month</div>
        </div>
      </div>

      {/* Daily trend */}
      <div className="console-card">
        <h2 className="console-card-title">Daily spend (30 days)</h2>
        <div className="console-bar-chart">
          {dailyCosts.map((day) => (
            <div key={day.date} className="console-bar-col" title={`${day.date}: ${formatCost(day.costUSD)} (${day.requests} requests)`}>
              <div
                className="console-bar"
                style={{ height: `${Math.round((day.costUSD / maxDailyCost) * 100)}%` }}
              />
              <div className="console-bar-label">
                {new Date(day.date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace(" ", "\n")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="console-two-col">
        {/* By model */}
        <div className="console-card">
          <h2 className="console-card-title">By model</h2>
          {byModel.length === 0 ? (
            <p className="auth-empty">No generation events yet.</p>
          ) : (
            <table className="console-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="console-table-num">Requests</th>
                  <th className="console-table-num">Input</th>
                  <th className="console-table-num">Output</th>
                  <th className="console-table-num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row) => (
                  <tr key={row.model}>
                    <td className="console-table-model">{row.model}</td>
                    <td className="console-table-num">{row.totalRequests.toLocaleString()}</td>
                    <td className="console-table-num">{formatTokens(row.totalInputTokens)}</td>
                    <td className="console-table-num">{formatTokens(row.totalOutputTokens)}</td>
                    <td className="console-table-num console-table-cost">{formatCost(row.totalCostUSD)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By experience */}
        <div className="console-card">
          <h2 className="console-card-title">By experience</h2>
          {byExperience.length === 0 ? (
            <p className="auth-empty">No generation events yet.</p>
          ) : (
            <table className="console-table">
              <thead>
                <tr>
                  <th>Experience</th>
                  <th className="console-table-num">Requests</th>
                  <th className="console-table-num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byExperience.map((row) => (
                  <tr key={row.experienceId}>
                    <td>{row.experienceTitle}</td>
                    <td className="console-table-num">{row.totalRequests.toLocaleString()}</td>
                    <td className="console-table-num console-table-cost">{formatCost(row.totalCostUSD)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="console-footnote">
        Pricing: Sonnet $3/$15 per 1M tokens · Haiku $0.25/$1.25 per 1M tokens (input/output).
        Costs are estimates based on usage events.
      </p>
    </div>
  )
}
