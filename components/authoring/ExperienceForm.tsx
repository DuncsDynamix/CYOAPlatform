"use client"

interface ExperienceFormData {
  title: string
  description: string
  genre: string
  type: string
}

interface ExperienceFormProps {
  data: ExperienceFormData
  onChange: (data: ExperienceFormData) => void
}

const TYPES = [
  { value: "cyoa_story", label: "Interactive Narrative" },
  { value: "l_and_d", label: "L&D / Training" },
  { value: "education", label: "Education" },
  { value: "publisher_ip", label: "Publisher IP" },
]

export function ExperienceForm({ data, onChange }: ExperienceFormProps) {
  const set = (key: keyof ExperienceFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => onChange({ ...data, [key]: e.target.value })

  return (
    <div className="auth-section">
      <h2 className="auth-section-title">Experience</h2>
      <div className="auth-field">
        <label>Title</label>
        <input type="text" value={data.title} onChange={set("title")} maxLength={200} placeholder="Give your experience a name" />
      </div>
      <div className="auth-field">
        <label>Description</label>
        <textarea value={data.description} onChange={set("description")} rows={3} maxLength={1000} placeholder="A short description shown on the experience card..." />
      </div>
      <div className="auth-row">
        <div className="auth-field">
          <label>Category</label>
          <input type="text" value={data.genre} onChange={set("genre")} placeholder="e.g. adventure, compliance, biology..." />
        </div>
        <div className="auth-field">
          <label>Type</label>
          <select value={data.type} onChange={set("type")}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
