# Demo Deployment — Vercel + Supabase

Getting the Gold Tap demo onto a URL Neil can open. Written 2026-08-06 against
the verified state of the code (production build passes; every requirement
below was checked against `lib/config.ts`, `middleware.ts` and the schema).

**Architecture decision, and why Neon is out:** production boot requires the
Supabase env vars (`lib/config.ts`), and the `/scenario` middleware checks org
membership by querying the `users` table *through the Supabase API* — so the
app's database must be the same Supabase project's Postgres. One Supabase
project therefore hosts both auth and the DB.

**Cost:** Vercel Hobby £0 (officially non-commercial — fine for showing a
mate; move to Pro ~$20/mo when it's a paid pilot). Supabase: either a project
in a **new free-tier org** (£0, but pauses after ~1 week idle — you must wake
it in the dashboard before any demo) or a project on your **existing Pro org**
(~$10/mo compute, never pauses, real backups; deleting the project stops the
charge). For a demo happening on a known date, free + the wake ritual is fine;
if the date is fuzzy or reliability matters more than £8, use the Pro org.
Plus usage: Anthropic tokens per playthrough and the ElevenLabs tier.

---

## 1. Supabase project (auth + database)

1. Create the project (free org or Pro org, per above). Region: London.
2. Note from **Settings → API**: the Project URL and the `anon` public key.
3. Note from **Settings → Database** BOTH connection strings:
   - **Direct** (port 5432) — for migrations and seeds from your laptop.
   - **Transaction pooler** (port 6543) — for the Vercel runtime. Append
     `?pgbouncer=true&connection_limit=1` (Prisma on serverless needs this).

## 2. Schema and seeds (run from your laptop)

```bash
# Schema — uses the DIRECT (5432) connection string
DATABASE_URL="postgres://…:5432/postgres" npx prisma migrate deploy

# Seeds — same direct URL. Order matters: goldtap creates the org.
DATABASE_URL="…" npx tsx prisma/seed-goldtap.ts
DATABASE_URL="…" npx tsx prisma/seed-goldtap-water-quality.ts
DATABASE_URL="…" npx tsx prisma/seed-fernbrook-safeguarding.ts
DATABASE_URL="…" npx tsx prisma/seed-hartleyvoss-ransomware.ts
```

**Then — not optional — lock the REST API down.** Supabase exposes every
public-schema table through its REST API via the anon key, which ships to
every browser; Prisma-created tables arrive with RLS off, i.e. wide open.
Paste `prisma/supabase-rls.sql` into the Supabase SQL editor and run it:
it default-denies everything and grants the one read the middleware needs
(each authenticated user's own `users` row). Prisma is unaffected. Re-run
it after any future migration that adds a table.

## 3. Demo login for Neil

The `/scenario` routes require a signed-in user who belongs to an org.

1. Supabase Dashboard → **Authentication → Users → Add user**: create an
   email + password account (e.g. `neil@goldtaptraining.co.uk`). Untick
   "send confirmation email" / use auto-confirm.
2. Copy the new user's UUID from the users list.
3. Link it to the Gold Tap org (direct DB URL again):

```bash
DATABASE_URL="…" npx tsx prisma/link-demo-user.ts <uuid> neil@goldtaptraining.co.uk "Neil"
```

Repeat for yourself so you can drive the demo from your own login.

## 4. Vercel project

1. vercel.com → New Project → import `DuncsDynamix/CYOAPlatform` from GitHub
   (connect the repo — push-to-deploy on `main`, preview URLs per branch,
   one-click rollback to any previous deployment). Framework auto-detects
   (Next.js). Set the build command to `prisma generate && next build` —
   Vercel's node_modules cache can occasionally skip Prisma client
   generation on rebuilds; this guards against it. If you later want the
   live demo insulated from day-to-day pushes, create a `demo` branch and
   set it as the project's production branch, promoting via merge.
2. Environment variables (Production):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | the **pooler** string (6543, `?pgbouncer=true&connection_limit=1`) |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL from step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from step 1 |
| `ANTHROPIC_API_KEY` | your key — set a monthly spend cap in the Anthropic console first |
| `ELEVENLABS_API_KEY` | your key (voice; omit and dialogues are silently text-only) |
| `ELEVENLABS_DEFAULT_VOICE_ID` | optional fallback voice |
| `UPSTASH_REDIS_REST_URL` / `…_TOKEN` | recommended (free tier) — see caveats |

3. Deploy. The engine routes already declare `maxDuration = 60` (generation
   calls run 10–30s; without this, serverless default timeouts kill them).

## 5. Verify (in order — each step depends on the last)

1. Open `https://<app>.vercel.app/login` → sign in as your own demo user.
2. Open `/scenario/goldtap-water-quality-event` → the Gold Tap-branded cover
   screen renders with objectives.
3. Begin → first scene generates (first generation confirms Anthropic key +
   DB writes + function duration all work).
4. Reach the Steve Malin call → his line plays aloud (confirms ElevenLabs).
5. Play to the end → Evidence Record renders; print preview shows it alone.
6. `/api/v1/engine/record?sessionId=<id>` returns the full session record.
7. RLS check: `curl "https://<project>.supabase.co/rest/v1/experiences?select=*" -H "apikey: <anon-key>"`
   returns `[]` — if it returns experience data, the RLS step was missed.

## 6. Demo-day checklist

- [ ] Free-tier Supabase only: open the dashboard the evening before — if the
      project is paused, restore it and re-run verify steps 1–3.
- [ ] Anthropic spend cap set; ElevenLabs quota has headroom.
- [ ] Send Neil: the login URL, his credentials, then the scenario link.
      **Tell him to sign in first, then open the scenario link** — the login
      redirect doesn't return you to the page you came from.
- [ ] Do one full fresh playthrough yourself that morning.

## Known limitations (accepted for the demo, fix at pilot)

- **Pre-generation may be cut short.** The engine fires parallel pre-generation
  of upcoming scenes without awaiting it; serverless can terminate that work
  after the response returns. Consequence: scene arrivals generate on demand
  more often (a few seconds' wait behind the "preparing" screen), never
  incorrectness. Vercel's `waitUntil` is the pilot-grade fix.
- **Without Upstash**, the cache and rate limits are per-instance in-memory —
  they work, but reset per serverless instance. Add the free Upstash tier.
- **The root URL is the fiction library** (TraverseStories Atrium), which is
  off-message for a training demo — send scenario links directly, don't send
  the bare domain.
- **Login doesn't deep-link back** to the page that redirected to it.
- **Image uploads are ephemeral** on Vercel — irrelevant to the three demo
  scenarios (no images), relevant if you later demo layout templates.
- **Vercel Hobby is non-commercial** by its terms; upgrade to Pro when a
  client cohort (rather than Neil) is using it.
