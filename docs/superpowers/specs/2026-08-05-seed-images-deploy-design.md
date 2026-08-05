# Seed images on the deployed site — design

**Date:** 2026-08-05
**Goal:** Get the 12 NWH slide images (`public/uploads/seed/`) deploying to Vercel so the
slides variant (experience …0042) can eventually go on the deployed Gold Tap shelf.

## Problem

The handover notes say 0042 must stay off the deployed shelf because its images live in
`public/uploads`, which is ephemeral on Vercel. The real root cause is narrower: Vercel
ephemerality only affects files written at **runtime**. Files committed under `public/`
deploy as static assets and persist fine. The seed images never deployed because the
`.gitignore` re-include is ineffective:

```
public/uploads/          # excludes the directory itself
!public/uploads/seed/    # dead rule — git cannot re-include below an excluded directory
```

`git check-ignore` confirms `public/uploads/seed/*` is still ignored. The images (1.7 MB,
12 files, copied from the local-only `thamesWater/` folder by `seed-nwh-slides.ts`) exist
only on the laptop.

## Scope

Seed images only. Runtime authoring uploads (`lib/storage/index.ts` → `public/uploads/`)
remain local-dev-only; swapping them to Supabase Storage is a separate future task.

## Change

1. `.gitignore`: replace `public/uploads/` with `public/uploads/*` (glob exclusion of
   contents, not the directory), keeping `!public/uploads/seed/`. Runtime uploads stay
   ignored; the seed directory becomes trackable.
2. Commit the 12 existing images in `public/uploads/seed/`.
3. No code changes: `lib/storage`, `seed-nwh-slides.ts`, and all `/uploads/seed/...` URLs
   stay as-is.

## Verification

- `git check-ignore public/uploads/seed/nwh-eusr-card.jpeg` exits non-zero (not ignored).
- `git status` shows only the 12 seed images newly tracked — no stray runtime uploads.
- After push: `https://traverse-five-lyart.vercel.app/uploads/seed/nwh-eusr-card.jpeg`
  returns 200.

## Out of scope / follow-on

- 0042 still needs the same modernisation checklist as 0040/0041 (orgId, published
  status, description, learning objectives) before it is seeded into the deployed DB —
  that is task 1 on the 2026-08-06 handover.
- Persistent runtime uploads (Supabase Storage bucket) — revisit when authoring on the
  deployed site matters.
