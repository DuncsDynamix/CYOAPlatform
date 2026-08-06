# Deploy NWH Seed Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 12 NWH slide images in `public/uploads/seed/` deploy to Vercel as static assets by fixing the dead `.gitignore` re-include and committing the images.

**Architecture:** No code changes. Git-only: swap the directory exclusion `public/uploads/` for the glob exclusion `public/uploads/*` so the existing `!public/uploads/seed/` negation takes effect, then track the images. Vercel bakes committed `public/` files into the deployment, which sidesteps runtime-filesystem ephemerality entirely.

**Tech Stack:** git, Vercel push-to-deploy (project `traverse-five`, deploys from `main`).

## Global Constraints

- Work directly in the current working tree on `main` — the 12 images are untracked, so they exist only here (a worktree/branch checkout elsewhere would not contain them).
- Stage ONLY `.gitignore` and `public/uploads/seed/*`. The working tree has unrelated modified files (`.claude/settings.local.json`, `next-env.d.ts`, `package.json`) that must not be committed.
- URLs must not change: seeds and DB rows reference `/uploads/seed/<name>` — no file moves or renames.
- User has pre-approved execution, merge to `main`, and push (push is required for the deployed-URL verification and is the point of the task: "get the images up").

---

### Task 1: Fix gitignore, commit images, verify deployment

**Files:**
- Modify: `.gitignore:32` (`public/uploads/` → `public/uploads/*`)
- Add (12 binaries): `public/uploads/seed/nwh-*.{jpeg,png}`

**Interfaces:**
- Consumes: nothing from other tasks (single-task plan).
- Produces: 12 static assets at `/uploads/seed/<name>` on the deployed site, e.g. `/uploads/seed/nwh-eusr-card.jpeg`. `prisma/seed-nwh-slides.ts` already references these exact URLs.

- [ ] **Step 1: Confirm the current failing state (test-first for a git rule)**

Run: `git check-ignore -v public/uploads/seed/nwh-eusr-card.jpeg`
Expected: exits 0, printing `.gitignore:32:public/uploads/	…` (image IS ignored — the bug).

- [ ] **Step 2: Edit `.gitignore`**

Replace lines 32-33:

```gitignore
public/uploads/
!public/uploads/seed/
```

with:

```gitignore
public/uploads/*
!public/uploads/seed/
```

- [ ] **Step 3: Verify the rule now passes**

Run: `git check-ignore -v public/uploads/seed/nwh-eusr-card.jpeg; echo "exit: $?"`
Expected: no ignore match, `exit: 1` (NOT ignored).

Run: `git status --porcelain public/uploads/`
Expected: exactly 13 entries — `.gitignore` change aside, the 12 `nwh-*` images and nothing else from `public/uploads/` (any other local uploads must remain ignored via `public/uploads/*`).

- [ ] **Step 4: Stage and commit ONLY the gitignore + images**

```bash
git add .gitignore public/uploads/seed/
git status --porcelain --cached   # confirm: .gitignore + 12 images, nothing else
git commit -m "fix: track NWH seed images so they deploy as static assets

public/uploads/ directory exclusion made the !public/uploads/seed/
re-include a dead rule (git cannot re-include below an excluded
directory). Glob exclusion public/uploads/* lets the negation work;
runtime uploads stay ignored.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push `main` (triggers Vercel deploy)**

```bash
git push origin main
```

- [ ] **Step 6: Verify the deployed asset**

Wait for the Vercel build (~1-3 min), then:

```bash
curl -s -o /dev/null -w "%{http_code}" https://traverse-five-lyart.vercel.app/uploads/seed/nwh-eusr-card.jpeg
```

Expected: `200`. If `404`, check the Vercel dashboard build for the new commit; retry after it completes. Spot-check one PNG too: `/uploads/seed/nwh-hand-washing.png`.
