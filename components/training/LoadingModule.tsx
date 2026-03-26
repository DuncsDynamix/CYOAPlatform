export function LoadingModule() {
  return (
    <div className="t-loading">
      <div className="t-generating">
        <div className="t-generating-dot" />
        <div className="t-generating-dot" />
        <div className="t-generating-dot" />
      </div>
      <p className="t-loading-text">Loading module…</p>
    </div>
  )
}
