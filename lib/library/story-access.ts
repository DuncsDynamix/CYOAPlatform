// The story page's visibility rule, kept apart from lib/auth on purpose:
// canAccessExperience deliberately treats a non-org "preview" row as public
// (a carve-out other surfaces rely on), but on /story anything short of
// published must read author-only. Pure and dependency-free so it is
// trivially unit-testable.

/** The slice of AuthUser (lib/auth) this rule reads. */
export interface StoryViewer {
  id: string
  orgId?: string | null
  orgRole?: string | null
}

export interface StoryAccessExperience {
  status: string
  authorId: string
  orgId?: string | null
}

/**
 * Published is public; anything else (draft, preview, or any future status)
 * is visible only to the author or an org editor (owner/author) of the
 * experience's org. Stricter than canAccessExperience by design.
 */
export function canViewStory(viewer: StoryViewer | null, experience: StoryAccessExperience): boolean {
  if (experience.status === "published") return true
  if (!viewer) return false
  if (experience.authorId === viewer.id) return true
  if (
    experience.orgId &&
    viewer.orgId === experience.orgId &&
    (viewer.orgRole === "owner" || viewer.orgRole === "author")
  ) {
    return true
  }
  return false
}
