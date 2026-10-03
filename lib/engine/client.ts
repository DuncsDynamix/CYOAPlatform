// Client-safe entry point: only pure, browser-safe engine pieces (no Prisma,
// no Anthropic SDK). "use client" files and anything they import must use this
// instead of "@/lib/engine".
export * from "./contract"
export { getChildLinks, validateExperienceGraph } from "./graph"
export type { ChildLink, GraphIssue, GraphValidationResult } from "./graph"
export { USE_CASE_PACKS } from "./usecases"
