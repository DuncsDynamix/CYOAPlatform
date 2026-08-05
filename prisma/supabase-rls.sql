-- Supabase-only hardening. Run in the Supabase SQL editor after
-- `prisma migrate deploy` (and again after any migration that creates a
-- new table). NOT a Prisma migration: auth.uid() only exists on Supabase.
--
-- Why: Supabase exposes every public-schema table through its REST API,
-- authorised by the anon key — which ships to every browser. Prisma-created
-- tables have RLS disabled, which leaves that API wide open. Enabling RLS
-- with no policies is default-deny; the app is unaffected because Prisma
-- connects as the table owner, which bypasses RLS.
--
-- The single exception: middleware.ts checks org membership by reading the
-- caller's own users row through the Supabase API, so authenticated users
-- get exactly that — their own row, read-only.

alter table public.orgs                enable row level security;
alter table public.users               enable row level security;
alter table public.experiences         enable row level security;
alter table public.experience_sessions enable row level security;
alter table public.generated_nodes     enable row level security;
alter table public.analytics_events    enable row level security;

drop policy if exists "users can read own row" on public.users;
create policy "users can read own row"
  on public.users
  for select
  to authenticated
  using (auth.uid()::text = id);

-- Verification (run after applying):
--   1. This should return rows when signed in, via the app's middleware path.
--   2. In the SQL editor's API docs / with the anon key:
--        curl "https://<project>.supabase.co/rest/v1/experiences?select=*" \
--          -H "apikey: <anon-key>"
--      must return [] (empty — denied by RLS), NOT experience data.
