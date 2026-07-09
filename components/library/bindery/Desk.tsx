"use client"

import { useEffect, useRef, useState } from "react"
import { getBinderyPack } from "@/lib/library/bindery-packs"
import { normalizeGenre } from "@/lib/library/halls"
import type { ExperienceContextPack } from "@/types/experience"
import { Drawer, type DraftListItem } from "./Drawer"
import { SheetTitle, type SheetTitleFields } from "./SheetTitle"
import { SheetPremise } from "./SheetPremise"
import { SheetCover } from "./SheetCover"
import { SheetPages } from "./SheetPages"

export interface BinderyDraft {
  id: string
  title: string
  genre: string | null
  description: string | null
  contextPack?: unknown
  shape?: unknown
  segments?: unknown
  coverImageUrl?: string | null
}

type SaveStatus = "saved" | "saving" | "unsaved"

// The Bindery's in-fiction save copy — replicates the Studio's autosave chip
// (app/(authoring)/experience/[id]/page.tsx: "Saved / Saving… / Unsaved")
// but in the desk's own vocabulary.
const SAVE_COPY: Record<SaveStatus, string> = {
  saved: "Pressed",
  saving: "Pressing…",
  unsaved: "Unpressed changes",
}

type SheetFields = { title: string; genre: string; description: string }

const DEFAULT_CONTEXT_PACK: ExperienceContextPack = {
  world: { description: "", rules: "", atmosphere: "" },
  actors: [],
  protagonist: { perspective: "second", role: "", knowledge: "", goal: "" },
  style: {
    tone: "",
    language: "en-GB",
    register: "literary",
    targetLength: { min: 150, max: 250 },
    styleNotes: "",
  },
  groundTruth: [],
  scripts: [],
}

// A resumed draft's contextPack may be missing sub-objects (older drafts,
// test fixtures) — fill in defaults for anything absent rather than let
// SheetPremise dereference undefined.
function mergeContextPack(raw: unknown): ExperienceContextPack {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ExperienceContextPack>
  return {
    ...DEFAULT_CONTEXT_PACK,
    ...r,
    world: { ...DEFAULT_CONTEXT_PACK.world, ...r.world },
    protagonist: { ...DEFAULT_CONTEXT_PACK.protagonist, ...r.protagonist },
    style: { ...DEFAULT_CONTEXT_PACK.style, ...r.style },
  }
}

function getCoverVariant(shape: unknown): number {
  return (shape as { coverVariant?: number } | null)?.coverVariant ?? 0
}

export function Desk({ drafts, packId }: { drafts: DraftListItem[]; packId?: string }) {
  const pack = getBinderyPack(packId ?? "cyoa_story")

  // null experience + view="drawer" is the resting state. "New" and "resume"
  // both move the view to "sheet"; only "resume" (and a completed first save)
  // ever populate `experience`.
  const [view, setView] = useState<"drawer" | "sheet">("drawer")
  const [experience, setExperience] = useState<BinderyDraft | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)

  const [title, setTitle] = useState("")
  const [genre, setGenre] = useState("general")
  const [description, setDescription] = useState("")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")

  const [contextPack, setContextPack] = useState<ExperienceContextPack>(DEFAULT_CONTEXT_PACK)
  const [shape, setShape] = useState<unknown>({})
  const [segments, setSegments] = useState<unknown>([])
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const coverVariant = getCoverVariant(shape)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contextPackDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const experienceRef = useRef<BinderyDraft | null>(null)
  experienceRef.current = experience
  // True while the first save's POST is on the wire. A debounce that fires
  // during that window must NOT issue a second POST (duplicate draft rows) —
  // it defers itself and retries once the create has resolved and
  // experienceRef holds the new id, at which point it PUTs.
  const creatingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (contextPackDebounceRef.current) clearTimeout(contextPackDebounceRef.current)
    }
  }, [])

  function handleNew() {
    setExperience(null)
    setTitle("")
    setGenre("general")
    setDescription("")
    setContextPack(DEFAULT_CONTEXT_PACK)
    setShape({})
    setSegments([])
    setCoverImageUrl(null)
    setSaveStatus("saved")
    setSheetIndex(0)
    setView("sheet")
  }

  async function handleResume(id: string) {
    const res = await fetch(`/api/v1/experience/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setExperience(data)
    setTitle(data.title ?? "")
    setGenre(normalizeGenre(data.genre))
    setDescription(data.description ?? "")
    setContextPack(mergeContextPack(data.contextPack))
    setShape(data.shape ?? {})
    setSegments(data.segments ?? [])
    setCoverImageUrl(data.coverImageUrl ?? null)
    setSaveStatus("saved")
    setSheetIndex(0)
    setView("sheet")
  }

  async function save(fields: SheetFields) {
    if (!fields.title.trim()) return
    const current = experienceRef.current
    if (!current && creatingRef.current) {
      // A create is already in flight. Firing a second POST now would bind a
      // duplicate draft — defer this save and let it re-run once the id lands.
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        save(fields)
      }, 2000)
      return
    }
    setSaveStatus("saving")
    try {
      if (!current) {
        creatingRef.current = true
        let created: BinderyDraft
        try {
          const res = await fetch("/api/v1/experience", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: fields.title,
              // "general" isn't a real genre for creation — it means "unset".
              genre: fields.genre === "general" ? undefined : fields.genre,
              description: fields.description || undefined,
              type: "cyoa_story",
            }),
          })
          if (!res.ok) throw new Error("create failed")
          created = await res.json()
        } finally {
          creatingRef.current = false
        }
        experienceRef.current = created
        setExperience(created)
      } else {
        const res = await fetch(`/api/v1/experience/${current.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: fields.title,
            genre: fields.genre,
            description: fields.description,
          }),
        })
        if (!res.ok) throw new Error("save failed")
      }
      setSaveStatus("saved")
    } catch {
      setSaveStatus("unsaved")
    }
  }

  function scheduleAutoSave(fields: SheetFields) {
    setSaveStatus("unsaved")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      save(fields)
    }, 2000)
  }

  // Sheets 2+ only ever PUT (an experience must already exist to reach
  // them — the tabs are disabled until then), so this skips the
  // create-vs-update branching that `save` handles for Sheet 1.
  async function savePatch(patch: Record<string, unknown>) {
    const current = experienceRef.current
    if (!current) return
    setSaveStatus("saving")
    try {
      const res = await fetch(`/api/v1/experience/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("save failed")
      setSaveStatus("saved")
    } catch {
      setSaveStatus("unsaved")
    }
  }

  function handleContextPackChange(pack: ExperienceContextPack) {
    setContextPack(pack)
    setSaveStatus("unsaved")
    if (contextPackDebounceRef.current) clearTimeout(contextPackDebounceRef.current)
    contextPackDebounceRef.current = setTimeout(() => {
      savePatch({ contextPack: pack })
    }, 2000)
  }

  function handleShuffle() {
    const nextShape = { ...(shape as Record<string, unknown>), coverVariant: (coverVariant + 1) % 8 }
    setShape(nextShape)
    savePatch({ shape: nextShape })
  }

  async function handleCoverUpload(file: File) {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/v1/upload/image", { method: "POST", body: formData })
    if (!res.ok) return
    const data = (await res.json()) as { url: string }
    setCoverImageUrl(data.url)
    savePatch({ coverImageUrl: data.url })
  }

  // SheetPages commits structural changes (a fresh outline laid out into
  // segments) as discrete actions rather than a typing stream, so this
  // patches straight through — no debounce, unlike handleContextPackChange.
  function handlePagesChange(fields: Partial<BinderyDraft>) {
    if (fields.segments !== undefined) setSegments(fields.segments)
    if (fields.shape !== undefined) setShape(fields.shape)
    savePatch(fields)
  }

  function handleFieldsChange(fields: SheetTitleFields) {
    const merged: SheetFields = {
      title: fields.title ?? title,
      genre: fields.genre ?? genre,
      description: fields.description ?? description,
    }
    setTitle(merged.title)
    setGenre(merged.genre)
    setDescription(merged.description)
    scheduleAutoSave(merged)
  }

  const hasExperience = !!experience

  return (
    <div className="lib-scene" data-hall={normalizeGenre(genre)}>
      <div className="lib-ambience" aria-hidden="true" />
      <div className="lib-bindery">
        <h1 className="lib-bindery-title">The Bindery</h1>
        <p className="lib-bindery-sub">Where a new {pack.vocabulary.book} is stitched together.</p>

        <div className="lib-desk">
          {view === "drawer" ? (
            <Drawer drafts={drafts} onResume={handleResume} onNew={handleNew} />
          ) : (
            <>
              <ul className="lib-sheet-nav">
                {pack.sheetTitles.map((label, i) => (
                  <li key={label}>
                    <button
                      type="button"
                      className="lib-sheet-tab"
                      aria-current={sheetIndex === i ? "step" : undefined}
                      disabled={i > 0 && !hasExperience}
                      onClick={() => setSheetIndex(i)}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>

              <p className="lib-field-hint" role="status">
                {SAVE_COPY[saveStatus]}
              </p>

              {sheetIndex === 0 && (
                <SheetTitle title={title} genre={genre} description={description} onChange={handleFieldsChange} />
              )}

              {sheetIndex === 1 && (
                <SheetPremise contextPack={contextPack} onChange={handleContextPackChange} />
              )}

              {sheetIndex === 2 && (
                <SheetCover
                  title={title}
                  genre={genre}
                  coverVariant={coverVariant}
                  coverImageUrl={coverImageUrl}
                  onShuffle={handleShuffle}
                  onUpload={handleCoverUpload}
                />
              )}

              {sheetIndex === 3 && experience && (
                <SheetPages
                  draft={{ ...experience, title, genre, description, contextPack, shape, segments, coverImageUrl }}
                  pack={pack}
                  onChange={handlePagesChange}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
