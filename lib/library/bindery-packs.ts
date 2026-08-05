// The use-case seam: everything author-facing the Bindery renders or prompts
// with comes from a pack. cyoa_story is the only pack in v1; a Training
// bindery later is a new entry here, not a component rewrite.
import type { NodeType } from "@/types/experience"

export interface BinderyTemplate {
  id: string
  label: string
  blurb: string
  chapters: number
  pagesPerChapter: [number, number]
  choiceMomentsPerChapter: [number, number]
  endpointCount: number
}

export interface BinderyPack {
  id: string
  vocabulary: {
    book: string
    chapter: string
    page: string
    pageWritten: string
    pageTold: string
    choice: string
    ending: string
  }
  sheetTitles: [string, string, string, string, string]
  palette: NodeType[]
  templates: BinderyTemplate[]
  outlineFraming: string
  chapterFraming: string
}

export const BINDERY_PACKS: Record<string, BinderyPack> = {
  cyoa_story: {
    id: "cyoa_story",
    vocabulary: {
      book: "book",
      chapter: "chapter",
      page: "page",
      pageWritten: "written by you",
      pageTold: "told by the engine",
      choice: "the reader decides",
      ending: "closing page",
    },
    sheetTitles: ["Title & genre", "The premise", "The cover", "The pages", "Bind & shelve"],
    palette: ["FIXED", "GENERATED", "CHOICE", "ENDPOINT"],
    templates: [
      {
        id: "short-tale",
        label: "A short tale",
        blurb: "An evening's read. Three chapters, two ways it can end.",
        chapters: 3,
        pagesPerChapter: [3, 5],
        choiceMomentsPerChapter: [1, 2],
        endpointCount: 2,
      },
      {
        id: "winding-path",
        label: "A winding path",
        blurb: "Six chapters that fork and rejoin. Three endings wait.",
        chapters: 6,
        pagesPerChapter: [4, 7],
        choiceMomentsPerChapter: [1, 3],
        endpointCount: 3,
      },
      {
        id: "epic",
        label: "An epic in chapters",
        blurb: "Ten chapters, many crossroads, four endings. A serious binding.",
        chapters: 10,
        pagesPerChapter: [5, 9],
        choiceMomentsPerChapter: [2, 3],
        endpointCount: 4,
      },
    ],
    outlineFraming:
      "You are the Bindery's planning assistant for an interactive branching story book. " +
      "Chapters must fork at reader decisions and REJOIN (diamond structure), never explode " +
      "into unmergeable trees. Endings are earned in the final chapters.",
    chapterFraming:
      "You are drafting one chapter of an interactive branching story book. Pages are either " +
      "authored prose or beat instructions for a narration engine. Keep beats concrete and " +
      "sensory; never write meta commentary.",
  },
}

export function getBinderyPack(id: string): BinderyPack {
  return BINDERY_PACKS[id] ?? BINDERY_PACKS.cyoa_story
}
