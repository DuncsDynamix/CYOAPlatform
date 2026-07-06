// Hall theme registry — the design source of truth for genre identity.
// Consumed by cover generation (M1), endpapers (M1), and hall rooms (M2).

export const HALL_IDS = ["fantasy", "sci-fi", "horror", "mystery", "romance", "adventure", "general"] as const
export type HallId = (typeof HALL_IDS)[number]

export interface Hall {
  id: HallId
  genreLabel: string
  roomName: string
  /** Endpaper / room paper tone */
  paper: string
  /** Deep ink tone for this hall */
  ink: string
  /** The hall's light: candle amber, instrument cyan, lamp green… */
  glow: string
  /** Book cover/spine colours drawn from this hall's shelves */
  spinePalette: string[]
  /** Ornament ids rendered by BookCover (see components/library/ornaments) */
  ornaments: string[]
}

const HALLS: Record<HallId, Hall> = {
  fantasy: {
    id: "fantasy", genreLabel: "Fantasy", roomName: "The Candlelit Archive",
    paper: "#F3E9D2", ink: "#2B1D0E", glow: "#E8A33D",
    spinePalette: ["#5B2333", "#1F3A2E", "#2E2440", "#7A4A1F", "#33415C", "#6B2E23"],
    ornaments: ["laurel", "sigil", "keystone"],
  },
  "sci-fi": {
    id: "sci-fi", genreLabel: "Sci-Fi", roomName: "The Star Vault",
    paper: "#E7EDF2", ink: "#0D1B2A", glow: "#5BC8D8",
    spinePalette: ["#0D1B2A", "#1B3A4B", "#3D2C52", "#14424C", "#26415E", "#41293D"],
    ornaments: ["orbit", "beacon", "lattice"],
  },
  horror: {
    id: "horror", genreLabel: "Horror", roomName: "The Restricted Section",
    paper: "#E4E1D5", ink: "#141410", glow: "#7C8F6C",
    spinePalette: ["#1C1B16", "#3A2E2A", "#2C3326", "#403636", "#25292B", "#4A3B2A"],
    ornaments: ["seal", "thorn", "eye"],
  },
  mystery: {
    id: "mystery", genreLabel: "Mystery", roomName: "The Midnight Reading Room",
    paper: "#EDE6D6", ink: "#17201B", glow: "#3F7A5A",
    spinePalette: ["#17352A", "#3F2A1D", "#232B3A", "#4A2430", "#2E3B2C", "#3B3024"],
    ornaments: ["magnifier", "key", "monocle"],
  },
  romance: {
    id: "romance", genreLabel: "Romance", roomName: "The Conservatory",
    paper: "#F7EEE7", ink: "#3B2430", glow: "#D9899B",
    spinePalette: ["#8C4A5E", "#B5766A", "#6E4A6B", "#A3555E", "#7E5A70", "#95606F"],
    ornaments: ["bloom", "ribbon", "sparrow"],
  },
  adventure: {
    id: "adventure", genreLabel: "Adventure", roomName: "The Map Room",
    paper: "#F0E6CE", ink: "#2E2414", glow: "#C98A3D",
    spinePalette: ["#5C4A1E", "#6B3A2A", "#324D3E", "#7A5230", "#44573F", "#8A5A28"],
    ornaments: ["compass", "summit", "anchor"],
  },
  general: {
    id: "general", genreLabel: "Stories", roomName: "The Common Room",
    paper: "#F5F0E8", ink: "#1A1209", glow: "#C4A882",
    spinePalette: ["#1A1A2E", "#8B1428", "#5C4A32", "#2D2D4E", "#6B2E23", "#33415C"],
    ornaments: ["rule", "fleuron", "colophon"],
  },
}

const ALIASES: Record<string, HallId> = {
  "sci-fi": "sci-fi", scifi: "sci-fi", "science fiction": "sci-fi", sf: "sci-fi",
  fantasy: "fantasy", horror: "horror", mystery: "mystery",
  romance: "romance", adventure: "adventure",
}

export function normalizeGenre(genre: string | null | undefined): HallId {
  const key = (genre ?? "").trim().toLowerCase()
  return ALIASES[key] ?? "general"
}

export function getHall(id: HallId): Hall {
  return HALLS[id]
}
