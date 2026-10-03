import type { BrandPack } from "@/lib/training/brand-pack"
import type { Accreditation, CourseAccreditationLink } from "@/lib/training/accreditations"
import type { Stage } from "@/lib/training/presentation"

/**
 * Demo brand data, applied by prisma/seed-goldtap-brand.ts. Accreditation
 * links are the owner's best guess (2026-10-03) and are expected to change
 * after Gold Tap reviews them.
 */

export const GOLD_TAP_ORG_ID = "00000000-0000-0000-0000-000000000051"
export const FERNBROOK_ORG_ID = "00000000-0000-0000-0000-000000000110"
export const HARTLEY_ORG_ID = "00000000-0000-0000-0000-000000000120"

const GT = "/brands/gold-tap-training"

export const BRAND_PACKS: Record<string, BrandPack> = {
  [GOLD_TAP_ORG_ID]: {
    displayName: "Gold Tap Training",
    logo: { onLight: `${GT}/logo-on-light.png`, onDark: `${GT}/logo-on-dark.png`, mark: `${GT}/mark.png` },
    colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" },
    imagery: { hero: `${GT}/courses/water.jpg`, courseFallback: `${GT}/courses/water.jpg` },
    recordPrefix: "GT",
  },
  [FERNBROOK_ORG_ID]: {
    displayName: "Fernbrook Care",
    colours: { brand: "#2E6E4E", onBrand: "#FFFFFF", header: "light", surfaceTone: "cool" },
    fonts: { heading: "source-serif-4", body: "nunito-sans" },
    recordPrefix: "FC",
  },
  [HARTLEY_ORG_ID]: {
    displayName: "Hartley & Voss",
    colours: { brand: "#43506B", onBrand: "#FFFFFF", header: "dark", surfaceTone: "neutral" },
    fonts: { heading: "lato", body: "lato" },
    recordPrefix: "HV",
  },
}

export const ORG_ACCREDITATIONS: Record<string, Accreditation[]> = {
  [GOLD_TAP_ORG_ID]: [
    { id: "eusr-nwh", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: `${GT}/eusr.png` },
    { id: "cabwi-l2d", name: "CABWI Level 2 Diploma (Water Operations)", awardingBody: "CABWI", badge: `${GT}/cabwi.png` },
  ],
}

const nwhLink: CourseAccreditationLink[] = [{ accreditationId: "eusr-nwh", relationship: "part_of" }]

export const COURSE_PRESENTATION: Record<
  string,
  { image?: string; durationMinutes: number; stages: Stage[]; accreditations?: CourseAccreditationLink[] }
> = {
  // The Doorstep
  "00000000-0000-0000-0000-000000000090": {
    image: `${GT}/courses/streetworks.jpg`,
    durationMinutes: 25,
    stages: [
      { label: "Briefing", startsAt: "n-intro" },
      { label: "Doorstep 1", startsAt: "n-scene-margaret" },
      { label: "Doorstep 2", startsAt: "n-scene-dean" },
      { label: "Review", startsAt: "ev-debrief" },
    ],
    accreditations: [{ accreditationId: "cabwi-l2d", relationship: "prepares_for" }],
  },
  // Discoloured: A Water Quality Event
  "00000000-0000-0000-0000-000000000080": {
    durationMinutes: 30,
    stages: [
      { label: "Morning", startsAt: "n1" },
      { label: "On site", startsAt: "n2" },
      { label: "The street", startsAt: "n4" },
      { label: "Review", startsAt: "ev1" },
    ],
    accreditations: [{ accreditationId: "cabwi-l2d", relationship: "prepares_for" }],
  },
  // A Day at Lee Valley
  "00000000-0000-0000-0000-000000000020": {
    durationMinutes: 40,
    stages: [
      { label: "Introduction", startsAt: "sd1" },
      { label: "Morning", startsAt: "n2" },
      { label: "Afternoon", startsAt: "n6" },
      { label: "Customer call", startsAt: "q4" },
    ],
    accreditations: [{ accreditationId: "eusr-nwh", relationship: "refresher_for" }],
  },
  // National Water Hygiene
  "00000000-0000-0000-0000-000000000040": {
    durationMinutes: 60,
    stages: [
      { label: "Module 1", startsAt: "n-intro" },
      { label: "Module 2", startsAt: "n-m2a" },
      { label: "Module 3", startsAt: "n-m3a" },
      { label: "Module 4", startsAt: "n-m4a" },
      { label: "Test", startsAt: "n-quiz-intro" },
    ],
    accreditations: nwhLink,
  },
  // National Water Hygiene: Interactive
  "00000000-0000-0000-0000-000000000041": {
    durationMinutes: 65,
    stages: [
      { label: "Module 1", startsAt: "n-intro" },
      { label: "Module 2", startsAt: "n-m2-briefing" },
      { label: "Module 3", startsAt: "n-m3-facts" },
      { label: "Module 4", startsAt: "n-m4-facts" },
      { label: "Test", startsAt: "n-quiz-intro" },
    ],
    accreditations: nwhLink,
  },
  // National Water Hygiene (Slides)
  "00000000-0000-0000-0000-000000000042": {
    durationMinutes: 60,
    stages: [
      { label: "Module 1", startsAt: "sd-intro" },
      { label: "Module 2", startsAt: "sd-m2" },
      { label: "Module 3", startsAt: "sd-m3" },
      { label: "Module 4", startsAt: "sd-m4" },
      { label: "Test", startsAt: "sd-quiz-intro" },
    ],
    accreditations: nwhLink,
  },
}
