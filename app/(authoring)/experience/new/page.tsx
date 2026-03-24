"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const GENRES = ["adventure", "mystery", "sci-fi", "horror", "romance", "fantasy"]
const TYPES = [
  { value: "cyoa_story", label: "CYOA Story (fiction)" },
  { value: "l_and_d", label: "L&D / Training" },
  { value: "education", label: "Education" },
  { value: "publisher_ip", label: "Publisher IP" },
]

export default function NewExperiencePage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [genre, setGenre] = useState("")
  const [type, setType] = useState("cyoa_story")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, string> = { title, description, type }
      if (genre) body.genre = genre

      const res = await fetch("/api/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create experience")
      }

      const experience = await res.json()
      router.push(`/experience/${experience.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="auth-page auth-page--narrow">
      <h1 className="auth-page-title">New Experience</h1>

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-label">
          Title *
          <input
            className="auth-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="The Haunted Lighthouse"
          />
        </label>

        <label className="auth-label">
          Description
          <textarea
            className="auth-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short blurb shown on the story card..."
          />
        </label>

        <label className="auth-label">
          Genre
          <select className="auth-select" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">— select —</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>

        <label className="auth-label">
          Type
          <select className="auth-select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-form-actions">
          <button type="button" onClick={() => router.push("/dashboard")} className="auth-btn">
            Cancel
          </button>
          <button type="submit" disabled={loading || !title.trim()} className="auth-btn auth-btn--primary">
            {loading ? "Creating…" : "Create experience"}
          </button>
        </div>
      </form>
    </div>
  )
}
