"use client"

import { useState } from "react"
import type { ExperienceContextPack, Actor, GroundTruthSource, ContextScript, NodeType } from "@/types/experience"

interface ContextPackEditorProps {
  data: ExperienceContextPack
  onChange: (data: ExperienceContextPack) => void
}

const NODE_TYPES: NodeType[] = ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"]

type Tab = "setting" | "characters" | "style" | "groundtruth" | "scripts"

const TABS: { id: Tab; label: string }[] = [
  { id: "setting",     label: "Setting" },
  { id: "characters",  label: "Characters" },
  { id: "style",       label: "Style" },
  { id: "groundtruth", label: "Ground Truth" },
  { id: "scripts",     label: "Scripts" },
]

function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <div className="auth-tag-list">
        {values.map((v, i) => (
          <span key={i} className="auth-tag">
            {v}
            <button type="button" className="auth-tag-remove" onClick={() => onChange(values.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder={placeholder ?? "Add item, press Enter"}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            const val = e.currentTarget.value.trim()
            if (val) {
              onChange([...values, val])
              e.currentTarget.value = ""
            }
          }
        }}
      />
    </div>
  )
}

export function ContextPackEditor({ data, onChange }: ContextPackEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>("setting")

  const setWorld = (key: keyof ExperienceContextPack["world"], value: string) =>
    onChange({ ...data, world: { ...data.world, [key]: value } })

  const setProtagonist = (key: keyof ExperienceContextPack["protagonist"], value: string) =>
    onChange({ ...data, protagonist: { ...data.protagonist, [key]: value } })

  const setStyle = (key: string, value: unknown) =>
    onChange({ ...data, style: { ...data.style, [key]: value } as typeof data.style })

  // Actors
  const updateActor = (index: number, updates: Partial<Actor>) => {
    const actors = [...data.actors]
    actors[index] = { ...actors[index], ...updates }
    onChange({ ...data, actors })
  }
  const addActor = () =>
    onChange({ ...data, actors: [...data.actors, { name: "", role: "", personality: "", speech: "", knowledge: "", relationshipToProtagonist: "" }] })
  const removeActor = (index: number) =>
    onChange({ ...data, actors: data.actors.filter((_, i) => i !== index) })

  // Ground Truth
  const addGroundTruth = () =>
    onChange({ ...data, groundTruth: [...(data.groundTruth ?? []), { label: "", type: "inline", fetchStrategy: "on_session_start", priority: "should_include", content: "" }] })
  const updateGroundTruth = (index: number, updates: Partial<GroundTruthSource>) => {
    const gt = [...(data.groundTruth ?? [])]
    gt[index] = { ...gt[index], ...updates }
    onChange({ ...data, groundTruth: gt })
  }
  const removeGroundTruth = (index: number) =>
    onChange({ ...data, groundTruth: (data.groundTruth ?? []).filter((_, i) => i !== index) })

  // Scripts
  const addScript = () =>
    onChange({ ...data, scripts: [...(data.scripts ?? []), { label: "", priority: "should", trigger: "always", instruction: "" }] })
  const updateScript = (index: number, updates: Partial<ContextScript>) => {
    const scripts = [...(data.scripts ?? [])]
    scripts[index] = { ...scripts[index], ...updates }
    onChange({ ...data, scripts })
  }
  const removeScript = (index: number) =>
    onChange({ ...data, scripts: (data.scripts ?? []).filter((_, i) => i !== index) })

  return (
    <div className="cpe-root">

      {/* ─── Tab bar ─── */}
      <div className="auth-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`auth-tab ${activeTab === t.id ? "auth-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Setting ─── */}
      {activeTab === "setting" && (
        <div className="cpe-tab-content">
          <div className="auth-field">
            <label>Description</label>
            <textarea value={data.world.description} rows={5}
              onChange={(e) => setWorld("description", e.target.value)}
              placeholder="Describe the setting and context. What does the participant need to know?" />
          </div>
          <div className="auth-field">
            <label>Rules</label>
            <textarea value={data.world.rules} rows={3}
              onChange={(e) => setWorld("rules", e.target.value)}
              placeholder="Constraints and rules governing this world..." />
          </div>
          <div className="auth-field">
            <label>Atmosphere</label>
            <textarea value={data.world.atmosphere} rows={3}
              onChange={(e) => setWorld("atmosphere", e.target.value)}
              placeholder="Tense, professional, whimsical..." />
          </div>
          <div className="auth-field">
            <label>Learning objectives <span style={{ fontWeight: 400, opacity: 0.65 }}>(training mode)</span></label>
            <TagInput
              values={data.learningObjectives ?? []}
              onChange={(v) => onChange({ ...data, learningObjectives: v })}
              placeholder="Add objective and press Enter…"
            />
            <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>Shown in the objectives drawer during scenario playback. Leave empty for story experiences.</span>
          </div>
        </div>
      )}

      {/* ─── Characters ─── */}
      {activeTab === "characters" && (
        <div className="cpe-tab-content">

          <div className="cpe-subsection-title">Protagonist</div>
          <div className="auth-row">
            <div className="auth-field">
              <label>Perspective</label>
              <select value={data.protagonist.perspective} onChange={(e) => setProtagonist("perspective", e.target.value)}>
                <option value="you">Second person (you)</option>
                <option value="I">First person (I)</option>
                <option value="they">Third person (they)</option>
              </select>
            </div>
            <div className="auth-field">
              <label>Role</label>
              <input type="text" value={data.protagonist.role}
                onChange={(e) => setProtagonist("role", e.target.value)}
                placeholder="Who is the participant in this experience?" />
            </div>
          </div>
          <div className="auth-field">
            <label>Knowledge at start</label>
            <textarea value={data.protagonist.knowledge} rows={3}
              onChange={(e) => setProtagonist("knowledge", e.target.value)}
              placeholder="What does the protagonist know when the experience begins?" />
          </div>
          <div className="auth-field">
            <label>Goal</label>
            <textarea value={data.protagonist.goal} rows={2}
              onChange={(e) => setProtagonist("goal", e.target.value)}
              placeholder="What is the protagonist trying to achieve?" />
          </div>

          <div className="cpe-subsection-title" style={{ marginTop: "0.5rem" }}>Actors</div>
          {data.actors.map((actor, i) => (
            <div key={i} className="cpe-item">
              <div className="cpe-item-header">
                <span className="cpe-item-title">{actor.name || `Actor ${i + 1}`}</span>
                <button type="button" className="auth-btn-danger" onClick={() => removeActor(i)}>Remove</button>
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Name</label>
                  <input type="text" value={actor.name} onChange={(e) => updateActor(i, { name: e.target.value })} />
                </div>
                <div className="auth-field">
                  <label>Role</label>
                  <input type="text" value={actor.role} onChange={(e) => updateActor(i, { role: e.target.value })} />
                </div>
              </div>
              <div className="auth-field">
                <label>Personality</label>
                <textarea rows={2} value={actor.personality} onChange={(e) => updateActor(i, { personality: e.target.value })}
                  placeholder="How they behave, their character traits..." />
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Speech pattern</label>
                  <textarea rows={2} value={actor.speech} onChange={(e) => updateActor(i, { speech: e.target.value })}
                    placeholder="How they speak, vocabulary, tone..." />
                </div>
                <div className="auth-field">
                  <label>Knowledge</label>
                  <textarea rows={2} value={actor.knowledge} onChange={(e) => updateActor(i, { knowledge: e.target.value })}
                    placeholder="What they know in this world..." />
                </div>
              </div>
              <div className="auth-field">
                <label>Relationship to protagonist</label>
                <textarea rows={2} value={actor.relationshipToProtagonist} onChange={(e) => updateActor(i, { relationshipToProtagonist: e.target.value })}
                  placeholder="How this actor relates to the participant..." />
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="auth-btn auth-btn--sm" onClick={addActor}>+ Add actor</button>
          </div>
        </div>
      )}

      {/* ─── Style ─── */}
      {activeTab === "style" && (
        <div className="cpe-tab-content">
          <div className="auth-field">
            <label>Tone</label>
            <textarea value={data.style.tone} rows={3}
              onChange={(e) => setStyle("tone", e.target.value)}
              placeholder="e.g. Tense and atmospheric, professional, playful..." />
          </div>
          <div className="auth-row">
            <div className="auth-field">
              <label>Language</label>
              <input type="text" value={data.style.language}
                onChange={(e) => setStyle("language", e.target.value)} placeholder="en-GB" />
            </div>
            <div className="auth-field">
              <label>Register</label>
              <select value={data.style.register} onChange={(e) => setStyle("register", e.target.value)}>
                <option value="literary">Literary</option>
                <option value="conversational">Conversational</option>
                <option value="formal">Formal</option>
                <option value="instructional">Instructional</option>
                <option value="professional">Professional</option>
                <option value="young_adult">Young adult</option>
              </select>
            </div>
            <div className="auth-field">
              <label>Min words</label>
              <input type="number" value={data.style.targetLength.min}
                onChange={(e) => setStyle("targetLength", { ...data.style.targetLength, min: Number(e.target.value) })} />
            </div>
            <div className="auth-field">
              <label>Max words</label>
              <input type="number" value={data.style.targetLength.max}
                onChange={(e) => setStyle("targetLength", { ...data.style.targetLength, max: Number(e.target.value) })} />
            </div>
          </div>
          <div className="auth-field">
            <label>Style notes</label>
            <textarea value={data.style.styleNotes} rows={4}
              onChange={(e) => setStyle("styleNotes", e.target.value)}
              placeholder="Additional guidance on prose or output style..." />
          </div>
        </div>
      )}

      {/* ─── Ground Truth ─── */}
      {activeTab === "groundtruth" && (
        <div className="cpe-tab-content">
          <p className="cpe-tab-description">
            Ground truth sources are authoritative reference material injected into every generation prompt.
            The AI is instructed to treat this content as fact when writing scenes.
          </p>
          {(data.groundTruth ?? []).map((gt, i) => (
            <div key={i} className="cpe-item">
              <div className="cpe-item-header">
                <span className="cpe-item-title">{gt.label || `Source ${i + 1}`}</span>
                <button type="button" className="auth-btn-danger" onClick={() => removeGroundTruth(i)}>Remove</button>
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Label</label>
                  <input type="text" value={gt.label} onChange={(e) => updateGroundTruth(i, { label: e.target.value })} placeholder="e.g. Operational standards, Regulatory framework..." />
                </div>
                <div className="auth-field">
                  <label>Source</label>
                  <select value={gt.type} onChange={(e) => updateGroundTruth(i, { type: e.target.value as GroundTruthSource["type"] })}>
                    <option value="inline">Inline text</option>
                    <option value="file">File (coming soon)</option>
                    <option value="url">URL (coming soon)</option>
                    <option value="folder">Folder (coming soon)</option>
                    <option value="database">Database (coming soon)</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label>Importance</label>
                  <select value={gt.priority} onChange={(e) => updateGroundTruth(i, { priority: e.target.value as GroundTruthSource["priority"] })}>
                    <option value="must_include">Required — AI must respect this</option>
                    <option value="should_include">Preferred — AI should follow this</option>
                    <option value="may_include">Optional — AI may use this</option>
                  </select>
                </div>
              </div>

              {gt.type === "inline" && (
                <div className="auth-field">
                  <label>Authoritative text</label>
                  <textarea value={gt.content ?? ""} rows={5}
                    onChange={(e) => updateGroundTruth(i, { content: e.target.value })}
                    placeholder="Paste or type the facts, policies, rules, or reference material the AI must treat as true..." />
                </div>
              )}

              {gt.type !== "inline" && (
                <div className="cpe-notice">
                  External sources (file, URL, folder, database) are not yet active — content will not be injected into generation until this feature is enabled. Use <strong>Inline text</strong> for now.
                </div>
              )}

              {(gt.type === "file" || gt.type === "folder") && (
                <div className="auth-field">
                  <label>Path</label>
                  <input type="text" value={gt.path ?? ""}
                    onChange={(e) => updateGroundTruth(i, { path: e.target.value })}
                    placeholder={gt.type === "folder" ? "/path/to/documents/" : "/path/to/file.md"} />
                </div>
              )}

              {gt.type === "url" && (
                <div className="auth-field">
                  <label>URL</label>
                  <input type="text" value={gt.path ?? ""}
                    onChange={(e) => updateGroundTruth(i, { path: e.target.value })}
                    placeholder="https://..." />
                </div>
              )}

              {gt.type === "database" && (
                <>
                  <div className="auth-row">
                    <div className="auth-field">
                      <label>MCP Server ID</label>
                      <input type="text" value={gt.mcpSource?.serverId ?? ""}
                        onChange={(e) => updateGroundTruth(i, { mcpSource: { ...gt.mcpSource, serverId: e.target.value, toolName: gt.mcpSource?.toolName ?? "", arguments: gt.mcpSource?.arguments ?? {} } })}
                        placeholder="server-id" />
                    </div>
                    <div className="auth-field">
                      <label>Tool name</label>
                      <input type="text" value={gt.mcpSource?.toolName ?? ""}
                        onChange={(e) => updateGroundTruth(i, { mcpSource: { ...gt.mcpSource, serverId: gt.mcpSource?.serverId ?? "", toolName: e.target.value, arguments: gt.mcpSource?.arguments ?? {} } })}
                        placeholder="query_knowledge_base" />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label>Arguments (JSON)</label>
                    <textarea value={JSON.stringify(gt.mcpSource?.arguments ?? {}, null, 2)} rows={3}
                      onChange={(e) => {
                        try {
                          const args = JSON.parse(e.target.value)
                          updateGroundTruth(i, { mcpSource: { ...gt.mcpSource, serverId: gt.mcpSource?.serverId ?? "", toolName: gt.mcpSource?.toolName ?? "", arguments: args } })
                        } catch { /* ignore parse errors while typing */ }
                      }}
                      placeholder='{ "collection": "policies" }' />
                  </div>
                </>
              )}
            </div>
          ))}
          <div>
            <button type="button" className="auth-btn auth-btn--sm" onClick={addGroundTruth}>+ Add ground truth source</button>
          </div>
        </div>
      )}

      {/* ─── Scripts ─── */}
      {activeTab === "scripts" && (
        <div className="cpe-tab-content">
          <p className="cpe-tab-description">
            Scripts are behavioural rules injected into generation prompts. Use them to enforce tone, constrain content, or apply specific instructions at certain points in the experience.
          </p>
          {(data.scripts ?? []).map((script, i) => (
            <div key={i} className="cpe-item">
              <div className="cpe-item-header">
                <span className="cpe-item-title">{script.label || `Script ${i + 1}`}</span>
                <button type="button" className="auth-btn-danger" onClick={() => removeScript(i)}>Remove</button>
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Label</label>
                  <input type="text" value={script.label}
                    onChange={(e) => updateScript(i, { label: e.target.value })}
                    placeholder="e.g. Maintain mystery, Enforce compliance..." />
                </div>
                <div className="auth-field">
                  <label>Priority</label>
                  <select value={script.priority} onChange={(e) => updateScript(i, { priority: e.target.value as ContextScript["priority"] })}>
                    <option value="must">Must</option>
                    <option value="should">Should</option>
                    <option value="may">May</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label>Trigger</label>
                  <select value={script.trigger} onChange={(e) => updateScript(i, { trigger: e.target.value as ContextScript["trigger"] })}>
                    <option value="always">Always active</option>
                    <option value="on_node_type">On node type</option>
                    <option value="on_state_condition">On state condition</option>
                  </select>
                </div>
              </div>

              {script.trigger === "on_node_type" && (
                <div className="auth-field">
                  <label>Only inject on these node types</label>
                  <div className="cpe-checkbox-row">
                    {NODE_TYPES.map((nt) => (
                      <label key={nt} className="cpe-checkbox-label">
                        <input type="checkbox"
                          checked={(script.nodeTypes ?? []).includes(nt)}
                          onChange={(e) => {
                            const current = script.nodeTypes ?? []
                            const updated = e.target.checked ? [...current, nt] : current.filter((t) => t !== nt)
                            updateScript(i, { nodeTypes: updated })
                          }}
                        />
                        {nt}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {script.trigger === "on_state_condition" && (
                <div className="auth-field">
                  <label>State condition</label>
                  <input type="text" value={script.stateCondition ?? ""}
                    onChange={(e) => updateScript(i, { stateCondition: e.target.value })}
                    placeholder="e.g. choicesMade > 5, flags.path === 'escalation'" />
                </div>
              )}

              <div className="auth-field">
                <label>Instruction</label>
                <textarea value={script.instruction} rows={3}
                  onChange={(e) => updateScript(i, { instruction: e.target.value })}
                  placeholder="The directive the engine must follow when this script is active..." />
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="auth-btn auth-btn--sm" onClick={addScript}>+ Add script</button>
          </div>
        </div>
      )}

    </div>
  )
}
