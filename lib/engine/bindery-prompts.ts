// Prompt builders for the Bindery: outline drafting, chapter drafting, and
// sample-telling (a single generated page shown as a live preview while
// authoring). The outline/chapter builders are structured-output prompts —
// they demand raw JSON and must never carry WRITING_STYLE_RULES, which is
// prose-generation guidance with no bearing on JSON shape. The sample
// builder is reader-facing prose and reuses WRITING_STYLE_RULES verbatim,
// same as lib/engine/prompts.ts does for in-session generation.
import type { BinderyPack, BinderyTemplate } from "@/lib/library/bindery-packs"
import type { BookOutline } from "@/lib/library/bindery"
import type { ExperienceContextPack } from "@/types/experience"
import { WRITING_STYLE_RULES } from "@/lib/engine/prompts"

const REF_CONVENTIONS =
  "Each node's `next` must be the `label` of another node in THIS chapter, or " +
  "`EXIT:<chapterIndex>` to hand off to a later chapter, or `END:<n>` if the outline " +
  "places an ending here."

const JSON_ONLY_INSTRUCTION = "Reply with the JSON object only. No prose, no code fences."

// contextPack.protagonist.perspective is typically "second" ("you") or
// "first" ("I"), but authoring UI free text and older drafts can leave it
// blank or spell it out ("third person") — normalize to the sentence the
// drafting prompts need, defaulting to second person (the platform's default
// voice, see DEFAULT_CONTEXT_PACK in Desk.tsx) when the field is empty.
function perspectiveLine(perspective: string): string {
  const p = perspective.trim().toLowerCase()
  if (p.startsWith("first")) return "PERSPECTIVE: told in the first person"
  if (p.startsWith("third")) return "PERSPECTIVE: told in the third person"
  return "PERSPECTIVE: told in the second person"
}

function contextSummary(contextPack: ExperienceContextPack): string {
  return `THE WORLD:
${contextPack.world.description}

THE PROTAGONIST:
Role: ${contextPack.protagonist.role}
Goal: ${contextPack.protagonist.goal}
${perspectiveLine(contextPack.protagonist.perspective)}

STYLE:
Tone: ${contextPack.style.tone}
Register: ${contextPack.style.register}`
}

export function buildOutlinePrompt(args: {
  pack: BinderyPack
  template: BinderyTemplate | null
  title: string
  genre: string
  contextPack: ExperienceContextPack
}): { system: string; user: string } {
  const { pack, template, title, genre, contextPack } = args

  const system = `${pack.outlineFraming}

You produce structured planning data as raw JSON. You never write narrative prose.`

  const templateBlock = template
    ? `SHAPE TO FOLLOW:
Chapters: ${template.chapters}
Pages per chapter: ${template.pagesPerChapter[0]}-${template.pagesPerChapter[1]}
Choice moments per chapter: ${template.choiceMomentsPerChapter[0]}-${template.choiceMomentsPerChapter[1]}
Endings: ${template.endpointCount}`
    : "SHAPE: no fixed template selected — choose a shape that fits the premise."

  const user = `TITLE: ${title}
GENRE: ${genre}

${contextSummary(contextPack)}

${templateBlock}

Produce a book outline as a JSON object with this exact shape:
- "chapters": an array of chapter objects, each with:
  - "title" (string): the chapter's title
  - "arc" (string): one or two sentences on what happens in this chapter
  - "approxPages" (integer): roughly how many pages this chapter spans
  - "choiceMoments" (integer): how many reader-decision points occur in this chapter
  - "convergesInto" (integer or null): the index of a later chapter this chapter's branches rejoin into, or null if it does not converge
- "endpointCount" (integer): the total number of distinct endings across the whole book
- "depthMin" (integer): the shortest possible path length through the book, in pages
- "depthMax" (integer): the longest possible path length through the book, in pages

${JSON_ONLY_INSTRUCTION}`

  return { system, user }
}

export function buildChapterPrompt(args: {
  pack: BinderyPack
  outline: BookOutline
  chapterIndex: number
  title: string
  contextPack: ExperienceContextPack
  existingChapterTitles: string[]
}): { system: string; user: string } {
  const { pack, outline, chapterIndex, title, contextPack, existingChapterTitles } = args
  const chapter = outline.chapters[chapterIndex]
  const isFinalChapter = chapterIndex === outline.chapters.length - 1

  const system = `${pack.chapterFraming}

You produce structured chapter data as raw JSON. You never write narrative prose directly in this response; page text is either finished prose (for written pages) or a beat instruction for a narration engine (for told pages).`

  const adjacentTitles = existingChapterTitles
    .map((t, i) => `${i}: ${t}`)
    .join("\n")

  const finalChapterInstruction = isFinalChapter
    ? `\n\nThis is a final chapter: you MUST include its ending nodes (kind "ending"), enough for the endings the outline places here. A final chapter with no ending traps the reader.`
    : ""

  const user = `BOOK TITLE: ${title}
THIS CHAPTER (index ${chapterIndex}): ${chapter.title}
CHAPTER ARC: ${chapter.arc}
APPROX PAGES: ${chapter.approxPages}
CHOICE MOMENTS: ${chapter.choiceMoments}
CONVERGES INTO CHAPTER: ${chapter.convergesInto === null ? "(does not converge)" : chapter.convergesInto}

OTHER CHAPTERS IN THE BOOK (for EXIT:<chapterIndex> hand-offs):
${adjacentTitles}

${contextSummary(contextPack)}

Produce a chapter proposal as a JSON object with this exact shape:
- "nodes": an array of node objects, each one of:
  - a page: { "kind": "page", "mode": "written" | "told", "label": string, "text": string, "next": string }
    - "mode" "written" means "text" is finished prose; "told" means "text" is a beat instruction for the narration engine
  - a choice: { "kind": "choice", "label": string, "prompt": string, "options": [{ "label": string, "next": string }, ...] }
    - "options" must have between 2 and 4 entries
  - an ending: { "kind": "ending", "label": string, "closingLine": string, "summaryInstruction": string }

Every node's "label" must be UNIQUE within this chapter.

Labels are page headings a reader could see. Write them as plain words with
spaces, capitalised like a book heading (for example "The Well at Dusk").
NEVER use underscores, hyphens as word separators, or identifier-style names
(for example "the_well" or "the-well" are wrong).

${REF_CONVENTIONS}${finalChapterInstruction}

${JSON_ONLY_INSTRUCTION}`

  return { system, user }
}

export function buildSinglePagePrompt(args: {
  pack: BinderyPack
  title: string
  contextPack: ExperienceContextPack
  written: boolean
  label: string
}): { system: string; user: string } {
  const { pack, title, contextPack, written, label } = args

  const system = `${pack.chapterFraming}

You are drafting a single page of the book, in isolation from the rest of the chapter. ${
    written
      ? "This is a written page: produce finished narrative prose."
      : "This is a told page: produce a beat instruction for the narration engine, not finished prose."
  }

You produce structured data as raw JSON. You never write prose directly outside the JSON's "text" field.`

  const user = `BOOK TITLE: ${title}
PAGE NAME: ${label || "(untitled)"}

${contextSummary(contextPack)}

Produce a JSON object with this exact shape:
- "text" (string): ${written ? "the finished prose for this page" : "a beat instruction for the narration engine"}

${JSON_ONLY_INSTRUCTION}`

  return { system, user }
}

export function buildSamplePrompt(args: {
  beatInstruction: string
  title: string
  contextPack: ExperienceContextPack
}): { system: string; user: string } {
  const { beatInstruction, title, contextPack } = args

  const system = `You are writing a single sample page for a reader considering the book "${title}", so they can see what its telling sounds like before committing to it.

${contextSummary(contextPack)}

${WRITING_STYLE_RULES}

Write ONLY the narrative prose. No titles, no headings, no labels.`

  const user = `Write a sample page for this beat: ${beatInstruction}

Write the page now.`

  return { system, user }
}
