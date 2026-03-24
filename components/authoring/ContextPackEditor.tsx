"use client"

import type { ExperienceContextPack, Actor, GroundTruthSource, ContextScript, NodeType } from "@/types/experience"

interface ContextPackEditorProps {
  data: ExperienceContextPack
  onChange: (data: ExperienceContextPack) => void
}

const NODE_TYPES: NodeType[] = ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"]

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
    <div className="auth-section">
      <h2 className="auth-section-title">Context Pack</h2>

      {/* ─── World ─── */}
      <h3 className="auth-subsection-title">World</h3>
      <div className="auth-field">
        <label>Description</label>
        <textarea value={data.world.description} rows={3}
          onChange={(e) => setWorld("description", e.target.value)}
          placeholder="Describe the setting and context. What does the participant need to know?" />
      </div>
      <div className="auth-row">
        <div className="auth-field">
          <label>Rules</label>
          <input type="text" value={data.world.rules}
            onChange={(e) => setWorld("rules", e.target.value)}
            placeholder="Constraints and rules governing this world..." />
        </div>
        <div className="auth-field">
          <label>Atmosphere</label>
          <input type="text" value={data.world.atmosphere}
            onChange={(e) => setWorld("atmosphere", e.target.value)}
            placeholder="Tense, professional, whimsical..." />
        </div>
      </div>

      {/* ─── Actors ─── */}
      <h3 className="auth-subsection-title">Actors</h3>
      {data.actors.map((actor, i) => (
        <div key={i} className="auth-choice-option">
          <div className="auth-row" style={{ marginBottom: "0.5rem" }}>
            <div className="auth-field">
              <label>Name</label>
              <input type="text" value={actor.name} onChange={(e) => updateActor(i, { name: e.target.value })} />
            </div>
            <div className="auth-field">
              <label>Role</label>
              <input type="text" value={actor.role} onChange={(e) => updateActor(i, { role: e.target.value })} />
            </div>
            <button type="button" className="auth-btn-danger" style={{ alignSelf: "flex-end" }} onClick={() => removeActor(i)}>Remove</button>
          </div>
          <div className="auth-field">
            <label>Personality</label>
            <input type="text" value={actor.personality} onChange={(e) => updateActor(i, { personality: e.target.value })} />
          </div>
          <div className="auth-row">
            <div className="auth-field">
              <label>Speech pattern</label>
              <input type="text" value={actor.speech} onChange={(e) => updateActor(i, { speech: e.target.value })} />
            </div>
            <div className="auth-field">
              <label>Knowledge</label>
              <input type="text" value={actor.knowledge} onChange={(e) => updateActor(i, { knowledge: e.target.value })} />
            </div>
          </div>
          <div className="auth-field">
            <label>Relationship to protagonist</label>
            <input type="text" value={actor.relationshipToProtagonist} onChange={(e) => updateActor(i, { relationshipToProtagonist: e.target.value })} />
          </div>
        </div>
      ))}
      <button type="button" className="auth-btn auth-btn--sm" onClick={addActor}>+ Add actor</button>

      {/* ─── Protagonist ─── */}
      <h3 className="auth-subsection-title">Protagonist</h3>
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
        <textarea value={data.protagonist.knowledge} rows={2}
          onChange={(e) => setProtagonist("knowledge", e.target.value)}
          placeholder="What does the protagonist know when the experience begins?" />
      </div>
      <div className="auth-field">
        <label>Goal</label>
        <input type="text" value={data.protagonist.goal}
          onChange={(e) => setProtagonist("goal", e.target.value)}
          placeholder="What is the protagonist trying to achieve?" />
      </div>

      {/* ─── Style ─── */}
      <h3 className="auth-subsection-title">Style</h3>
      <div className="auth-row">
        <div className="auth-field">
          <label>Tone</label>
          <input type="text" value={data.style.tone}
            onChange={(e) => setStyle("tone", e.target.value)}
            placeholder="e.g. Tense and atmospheric, professional, playful..." />
        </div>
        <div className="auth-field">
          <label>Language</label>
          <input type="text" value={data.style.language}
            onChange={(e) => setStyle("language", e.target.value)} placeholder="en-GB" />
        </div>
      </div>
      <div className="auth-row">
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
        <textarea value={data.style.styleNotes} rows={2}
          onChange={(e) => setStyle("styleNotes", e.target.value)}
          placeholder="Additional guidance on prose or output style..." />
      </div>

      {/* ─── Ground Truth ─── */}
      <h3 className="auth-subsection-title">Ground Truth Sources</h3>
      {(data.groundTruth ?? []).map((gt, i) => (
        <div key={i} className="auth-choice-option">
          <div className="auth-row" style={{ marginBottom: "0.5rem" }}>
            <div className="auth-field">
              <label>Label</label>
              <input type="text" value={gt.label} onChange={(e) => updateGroundTruth(i, { label: e.target.value })} placeholder="e.g. Core facts, Policy document..." />
            </div>
            <div className="auth-field">
              <label>Source type</label>
              <select value={gt.type} onChange={(e) => updateGroundTruth(i, { type: e.target.value as GroundTruthSource["type"] })}>
                <option value="inline">Inline text</option>
                <option value="file">File</option>
                <option value="url">URL</option>
                <option value="folder">Folder</option>
                <option value="database">MCP / Database</option>
              </select>
            </div>
            <button type="button" className="auth-btn-danger" style={{ alignSelf: "flex-end" }} onClick={() => removeGroundTruth(i)}>Remove</button>
          </div>
          <div className="auth-row" style={{ marginBottom: "0.5rem" }}>
            <div className="auth-field">
              <label>Fetch strategy</label>
              <select value={gt.fetchStrategy} onChange={(e) => updateGroundTruth(i, { fetchStrategy: e.target.value as GroundTruthSource["fetchStrategy"] })}>
                <option value="on_session_start">On session start</option>
                <option value="on_node_generation">On each generation</option>
                <option value="on_demand">On demand</option>
              </select>
            </div>
            <div className="auth-field">
              <label>Priority</label>
              <select value={gt.priority} onChange={(e) => updateGroundTruth(i, { priority: e.target.value as GroundTruthSource["priority"] })}>
                <option value="must_include">Must include</option>
                <option value="should_include">Should include</option>
                <option value="may_include">May include</option>
              </select>
            </div>
          </div>

          {gt.type === "inline" && (
            <div className="auth-field">
              <label>Content</label>
              <textarea value={gt.content ?? ""} rows={3}
                onChange={(e) => updateGroundTruth(i, { content: e.target.value })}
                placeholder="Authoritative facts, rules, or reference material..." />
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
      <button type="button" className="auth-btn auth-btn--sm" onClick={addGroundTruth}>+ Add ground truth source</button>

      {/* ─── Scripts ─── */}
      <h3 className="auth-subsection-title">Scripts</h3>
      {(data.scripts ?? []).map((script, i) => (
        <div key={i} className="auth-choice-option">
          <div className="auth-row" style={{ marginBottom: "0.5rem" }}>
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
            <button type="button" className="auth-btn-danger" style={{ alignSelf: "flex-end" }} onClick={() => removeScript(i)}>Remove</button>
          </div>
          <div className="auth-field" style={{ marginBottom: "0.5rem" }}>
            <label>Trigger</label>
            <select value={script.trigger} onChange={(e) => updateScript(i, { trigger: e.target.value as ContextScript["trigger"] })}>
              <option value="always">Always active</option>
              <option value="on_node_type">On specific node types</option>
              <option value="on_state_condition">On state condition</option>
            </select>
          </div>

          {script.trigger === "on_node_type" && (
            <div className="auth-field" style={{ marginBottom: "0.5rem" }}>
              <label>Node types</label>
              <div className="auth-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                {NODE_TYPES.map((nt) => (
                  <label key={nt} className="auth-label--inline" style={{ fontSize: "0.78rem", gap: "0.3rem" }}>
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
            <div className="auth-field" style={{ marginBottom: "0.5rem" }}>
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
      <button type="button" className="auth-btn auth-btn--sm" onClick={addScript}>+ Add script</button>
    </div>
  )
}
