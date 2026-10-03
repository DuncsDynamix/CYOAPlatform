"use client"

import { useState } from "react"
import type { NodeType } from "@/types/experience"
import { DEFAULT_VISIBILITY } from "@/lib/engine/contract"
import type { ContextPack, Character, ReferenceItem, ReferenceRole, ContextRule, Visibility } from "@/lib/engine/contract"

interface ContextPackEditorProps {
  data: ContextPack
  onChange: (data: ContextPack) => void
}

const NODE_TYPES: NodeType[] = ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"]

type Tab = "setting" | "characters" | "style" | "references" | "rules"

const TABS: { id: Tab; label: string }[] = [
  { id: "setting",     label: "Setting" },
  { id: "characters",  label: "Characters" },
  { id: "style",       label: "Style" },
  { id: "references",  label: "References" },
  { id: "rules",       label: "Rules" },
]

const ROLE_LABELS: Record<ReferenceRole, string> = {
  reference: "Reference material",
  exemplar: "Example (e.g. call transcript)",
  case_data: "Case facts",
}

const VISIBILITY_OPTIONS: { id: Visibility; label: string }[] = [
  { id: "scenes", label: "Scenes" },
  { id: "characters", label: "Characters" },
  { id: "assessor", label: "Assessor" },
]

function parseTranscript(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":")
    return i > 0 ? { speaker: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { speaker: "Unknown", text: l }
  })
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ref-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

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

  const core = data.core

  const setCore = <K extends keyof ContextPack["core"]>(key: K, value: ContextPack["core"][K]) =>
    onChange({ ...data, core: { ...core, [key]: value } })

  const setSetting = (patch: Partial<ContextPack["core"]["setting"]>) =>
    setCore("setting", { ...core.setting, ...patch })

  const setParticipant = (patch: Partial<ContextPack["core"]["participant"]>) =>
    setCore("participant", { ...core.participant, ...patch })

  const setStyle = (patch: Partial<ContextPack["core"]["style"]>) =>
    setCore("style", { ...core.style, ...patch })

  // Characters
  const updateCharacter = (index: number, updates: Partial<Character>) => {
    const characters = [...core.characters]
    characters[index] = { ...characters[index], ...updates }
    setCore("characters", characters)
  }
  const addCharacter = () =>
    setCore("characters", [...core.characters, { name: "", role: "", personality: "", speech: "", knowledge: "", relationshipToParticipant: "" }])
  const removeCharacter = (index: number) =>
    setCore("characters", core.characters.filter((_, i) => i !== index))

  // References
  const addReference = () =>
    setCore("references", [
      ...core.references,
      { id: newId(), label: "", role: "reference", priority: "should", source: { kind: "text", text: "" } },
    ])
  const updateReference = (index: number, updates: Partial<ReferenceItem>) => {
    const references = [...core.references]
    references[index] = { ...references[index], ...updates }
    setCore("references", references)
  }
  const removeReference = (index: number) =>
    setCore("references", core.references.filter((_, i) => i !== index))

  // Rules
  const addRule = () =>
    setCore("rules", [...core.rules, { label: "", priority: "should", trigger: "always", instruction: "" }])
  const updateRule = (index: number, updates: Partial<ContextRule>) => {
    const rules = [...core.rules]
    rules[index] = { ...rules[index], ...updates }
    setCore("rules", rules)
  }
  const removeRule = (index: number) =>
    setCore("rules", core.rules.filter((_, i) => i !== index))

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
            <textarea value={core.setting.summary} rows={5}
              onChange={(e) => setSetting({ summary: e.target.value })}
              placeholder="Describe the setting and context. What does the participant need to know?" />
          </div>
          <div className="auth-field">
            <label>Rules</label>
            <textarea value={core.setting.details ?? ""} rows={3}
              onChange={(e) => setSetting({ details: e.target.value })}
              placeholder="Constraints and rules governing this world..." />
          </div>
          {data.extension.kind === "story" && (
            <div className="auth-field">
              <label>Atmosphere</label>
              <textarea value={data.extension.atmosphere} rows={3}
                onChange={(e) => {
                  if (data.extension.kind !== "story") return
                  onChange({ ...data, extension: { ...data.extension, atmosphere: e.target.value } })
                }}
                placeholder="Tense, professional, whimsical..." />
            </div>
          )}
          {data.extension.kind === "training" && (
            <div className="auth-field">
              <label>Learning objectives <span style={{ fontWeight: 400, opacity: 0.65 }}>(training mode)</span></label>
              <TagInput
                values={data.extension.learningObjectives}
                onChange={(v) => {
                  if (data.extension.kind !== "training") return
                  onChange({ ...data, extension: { ...data.extension, learningObjectives: v } })
                }}
                placeholder="Add objective and press Enter…"
              />
              <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>Shown in the objectives drawer during scenario playback.</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Characters ─── */}
      {activeTab === "characters" && (
        <div className="cpe-tab-content">

          <div className="cpe-subsection-title">Participant</div>
          <div className="auth-row">
            <div className="auth-field">
              <label>Perspective</label>
              <select value={core.participant.perspective} onChange={(e) => setParticipant({ perspective: e.target.value as ContextPack["core"]["participant"]["perspective"] })}>
                <option value="second">Second person (you)</option>
                <option value="first">First person (I)</option>
                <option value="third">Third person (they)</option>
              </select>
            </div>
            <div className="auth-field">
              <label>Role</label>
              <input type="text" value={core.participant.role}
                onChange={(e) => setParticipant({ role: e.target.value })}
                placeholder="Who is the participant in this experience?" />
            </div>
          </div>
          <div className="auth-field">
            <label>Knowledge at start</label>
            <textarea value={core.participant.startingKnowledge} rows={3}
              onChange={(e) => setParticipant({ startingKnowledge: e.target.value })}
              placeholder="What does the participant know when the experience begins?" />
          </div>
          <div className="auth-field">
            <label>Goal</label>
            <textarea value={core.participant.goal} rows={2}
              onChange={(e) => setParticipant({ goal: e.target.value })}
              placeholder="What is the participant trying to achieve?" />
          </div>

          <div className="cpe-subsection-title" style={{ marginTop: "0.5rem" }}>Actors</div>
          {core.characters.map((actor, i) => (
            <div key={i} className="cpe-item">
              <div className="cpe-item-header">
                <span className="cpe-item-title">{actor.name || `Actor ${i + 1}`}</span>
                <button type="button" className="auth-btn-danger" onClick={() => removeCharacter(i)}>Remove</button>
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Name</label>
                  <input type="text" value={actor.name} onChange={(e) => updateCharacter(i, { name: e.target.value })} />
                </div>
                <div className="auth-field">
                  <label>Role</label>
                  <input type="text" value={actor.role} onChange={(e) => updateCharacter(i, { role: e.target.value })} />
                </div>
              </div>
              <div className="auth-field">
                <label>Personality</label>
                <textarea rows={2} value={actor.personality} onChange={(e) => updateCharacter(i, { personality: e.target.value })}
                  placeholder="How they behave, their character traits..." />
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Speech pattern</label>
                  <textarea rows={2} value={actor.speech} onChange={(e) => updateCharacter(i, { speech: e.target.value })}
                    placeholder="How they speak, vocabulary, tone..." />
                </div>
                <div className="auth-field">
                  <label>Knowledge</label>
                  <textarea rows={2} value={actor.knowledge} onChange={(e) => updateCharacter(i, { knowledge: e.target.value })}
                    placeholder="What they know in this world..." />
                </div>
              </div>
              <div className="auth-field">
                <label>Relationship to participant</label>
                <textarea rows={2} value={actor.relationshipToParticipant} onChange={(e) => updateCharacter(i, { relationshipToParticipant: e.target.value })}
                  placeholder="How this actor relates to the participant..." />
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="auth-btn auth-btn--sm" onClick={addCharacter}>+ Add actor</button>
          </div>
        </div>
      )}

      {/* ─── Style ─── */}
      {activeTab === "style" && (
        <div className="cpe-tab-content">
          <div className="auth-field">
            <label>Tone</label>
            <textarea value={core.style.tone} rows={3}
              onChange={(e) => setStyle({ tone: e.target.value })}
              placeholder="e.g. Tense and atmospheric, professional, playful..." />
          </div>
          <div className="auth-row">
            <div className="auth-field">
              <label>Language</label>
              <input type="text" value={core.style.language}
                onChange={(e) => setStyle({ language: e.target.value })} placeholder="en-GB" />
            </div>
            <div className="auth-field">
              <label>Register</label>
              <select value={core.style.register} onChange={(e) => setStyle({ register: e.target.value })}>
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
              <input type="number" value={core.style.targetLength.min}
                onChange={(e) => setStyle({ targetLength: { ...core.style.targetLength, min: Number(e.target.value) } })} />
            </div>
            <div className="auth-field">
              <label>Max words</label>
              <input type="number" value={core.style.targetLength.max}
                onChange={(e) => setStyle({ targetLength: { ...core.style.targetLength, max: Number(e.target.value) } })} />
            </div>
          </div>
          <div className="auth-field">
            <label>Style notes</label>
            <textarea value={core.style.notes} rows={4}
              onChange={(e) => setStyle({ notes: e.target.value })}
              placeholder="Additional guidance on prose or output style..." />
          </div>
        </div>
      )}

      {/* ─── References ─── */}
      {activeTab === "references" && (
        <div className="cpe-tab-content">
          <p className="cpe-tab-description">
            References are authoritative material the AI draws on. Choose who can see each item:
            scenes, characters, and the assessor.
          </p>
          {core.references.map((ref, i) => {
            const visible = ref.visibleTo ?? DEFAULT_VISIBILITY[ref.role]
            const isTranscript = ref.source.kind === "transcript"
            return (
              <div key={ref.id} className="cpe-item">
                <div className="cpe-item-header">
                  <span className="cpe-item-title">{ref.label || `Reference ${i + 1}`}</span>
                  <button type="button" className="auth-btn-danger" onClick={() => removeReference(i)}>Remove</button>
                </div>
                <div className="auth-row">
                  <div className="auth-field">
                    <label>Label</label>
                    <input type="text" value={ref.label} onChange={(e) => updateReference(i, { label: e.target.value })} placeholder="e.g. Operational standards, Regulatory framework..." />
                  </div>
                  <div className="auth-field">
                    <label>Role</label>
                    <select value={ref.role} onChange={(e) => updateReference(i, { role: e.target.value as ReferenceRole })}>
                      {(Object.keys(ROLE_LABELS) as ReferenceRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="auth-field">
                    <label>Priority</label>
                    <select value={ref.priority} onChange={(e) => updateReference(i, { priority: e.target.value as ReferenceItem["priority"] })}>
                      <option value="must">Required: AI must respect this</option>
                      <option value="should">Preferred: AI should follow this</option>
                      <option value="may">Optional: AI may use this</option>
                    </select>
                  </div>
                </div>

                <div className="auth-field">
                  <label>Visible to</label>
                  <div className="cpe-checkbox-row">
                    {VISIBILITY_OPTIONS.map((v) => (
                      <label key={v.id} className="cpe-checkbox-label">
                        <input type="checkbox"
                          checked={visible.includes(v.id)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...visible, v.id] : visible.filter((x) => x !== v.id)
                            updateReference(i, { visibleTo: next })
                          }}
                        />
                        {v.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="auth-field">
                  <label>Format</label>
                  <div className="cpe-checkbox-row">
                    <button type="button"
                      className={`auth-btn auth-btn--sm ${!isTranscript ? "auth-btn--active" : ""}`}
                      onClick={() => {
                        if (!isTranscript) return
                        const turns = ref.source.kind === "transcript" ? ref.source.turns : []
                        updateReference(i, { source: { kind: "text", text: turns.map((t) => `${t.speaker}: ${t.text}`).join("\n") } })
                      }}>Text</button>
                    <button type="button"
                      className={`auth-btn auth-btn--sm ${isTranscript ? "auth-btn--active" : ""}`}
                      onClick={() => {
                        if (isTranscript) return
                        const text = ref.source.kind === "text" ? ref.source.text : ""
                        updateReference(i, { source: { kind: "transcript", turns: parseTranscript(text) } })
                      }}>Transcript</button>
                  </div>
                </div>

                {ref.source.kind === "text" && (
                  <div className="auth-field">
                    <label>Authoritative text</label>
                    <textarea value={ref.source.text} rows={5}
                      onChange={(e) => updateReference(i, { source: { kind: "text", text: e.target.value } })}
                      placeholder="Paste or type the facts, policies, rules, or reference material the AI must treat as true..." />
                  </div>
                )}

                {ref.source.kind === "transcript" && (
                  <div className="auth-field">
                    <label>Transcript (one line per turn, as Speaker: line)</label>
                    <textarea
                      defaultValue={ref.source.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")}
                      rows={8}
                      onChange={(e) => updateReference(i, { source: { kind: "transcript", turns: parseTranscript(e.target.value) } })}
                      placeholder={"Agent: Thanks for calling, how can I help?\nCustomer: My bill looks wrong."} />
                  </div>
                )}

                {ref.source.kind === "retrieval" && (
                  <div className="cpe-notice">This reference is fetched from an external source and is not editable here.</div>
                )}
              </div>
            )
          })}
          <div>
            <button type="button" className="auth-btn auth-btn--sm" onClick={addReference}>+ Add reference</button>
          </div>
        </div>
      )}

      {/* ─── Rules ─── */}
      {activeTab === "rules" && (
        <div className="cpe-tab-content">
          <p className="cpe-tab-description">
            Rules are behavioural instructions injected into generation prompts. Use them to enforce tone, constrain content, or apply specific instructions at certain points in the experience.
          </p>
          {core.rules.map((script, i) => (
            <div key={i} className="cpe-item">
              <div className="cpe-item-header">
                <span className="cpe-item-title">{script.label || `Rule ${i + 1}`}</span>
                <button type="button" className="auth-btn-danger" onClick={() => removeRule(i)}>Remove</button>
              </div>
              <div className="auth-row">
                <div className="auth-field">
                  <label>Label</label>
                  <input type="text" value={script.label}
                    onChange={(e) => updateRule(i, { label: e.target.value })}
                    placeholder="e.g. Maintain mystery, Enforce compliance..." />
                </div>
                <div className="auth-field">
                  <label>Priority</label>
                  <select value={script.priority} onChange={(e) => updateRule(i, { priority: e.target.value as ContextRule["priority"] })}>
                    <option value="must">Must</option>
                    <option value="should">Should</option>
                    <option value="may">May</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label>Trigger</label>
                  <select value={script.trigger} onChange={(e) => updateRule(i, { trigger: e.target.value as ContextRule["trigger"] })}>
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
                            updateRule(i, { nodeTypes: updated })
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
                    onChange={(e) => updateRule(i, { stateCondition: e.target.value })}
                    placeholder="e.g. choicesMade > 5, flags.path === 'escalation'" />
                </div>
              )}

              <div className="auth-field">
                <label>Instruction</label>
                <textarea value={script.instruction} rows={3}
                  onChange={(e) => updateRule(i, { instruction: e.target.value })}
                  placeholder="The directive the engine must follow when this rule is active..." />
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="auth-btn auth-btn--sm" onClick={addRule}>+ Add rule</button>
          </div>
        </div>
      )}

    </div>
  )
}
