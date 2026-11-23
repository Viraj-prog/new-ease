-- Saved places and recent places. Run once in the Supabase SQL editor. It is safe to run again.
--
-- Two new tables; nothing existing is changed. Every row belongs to one user and
-- row-level security lets that user (and nobody else) read and change it.

-- 1. Saved places: Home, Work, School and any others the user adds.
create table if not exists public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  "userId"    uuid not null references public.users ("userId") on delete cascade,
  label       text not null,
  -- 'home' / 'work' / 'school' are the three fixed slots; 'other' is a custom place.
  kind        text not null default 'other' check (kind in ('home', 'work', 'school', 'other')),
  address     text not null,
  "createdAt" timestamptz not null default now(),
  unique ("userId", label)
);

-- 2. Recent places: where the user last booked or posted a trip to. One row per address;
--    "lastUsedAt" moves forward each time it is used again.
create table if not exists public.recent_places (
  id            uuid primary key default gen_random_uuid(),
  "userId"      uuid not null references public.users ("userId") on delete cascade,
  address       text not null,
  "lastUsedAt"  timestamptz not null default now(),
  unique ("userId", address)
);

create index if not exists recent_places_user_time
  on public.recent_places ("userId", "lastUsedAt" desc);

-- 3. Row-level security: own rows only.
alter table public.saved_places enable row level security;
alter table public.recent_places enable row level security;

drop policy if exists "saved read own" on public.saved_places;
create policy "saved read own" on public.saved_places
  for select to authenticated using (auth.uid() = "userId");

drop policy if exists "saved insert own" on public.saved_places;
create policy "saved insert own" on public.saved_places
  for insert to authenticated with check (auth.uid() = "userId");

drop policy if exists "saved update own" on public.saved_places;
create policy "saved update own" on public.saved_places
  for update to authenticated
  using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "saved delete own" on public.saved_places;
create policy "saved delete own" on public.saved_places
  for delete to authenticated using (auth.uid() = "userId");

drop policy if exists "recent read own" on public.recent_places;
create policy "recent read own" on public.recent_places
  for select to authenticated using (auth.uid() = "userId");

drop policy if exists "recent insert own" on public.recent_places;
create policy "recent insert own" on public.recent_places
  for insert to authenticated with check (auth.uid() = "userId");

drop policy if exists "recent update own" on public.recent_places;
create policy "recent update own" on public.recent_places
  for update to authenticated
  using (auth.uid() = "userId") with check (auth.uid() = "userId");

drop policy if exists "recent delete own" on public.recent_places;
create policy "recent delete own" on public.recent_places
  for delete to authenticated using (auth.uid() = "userId");
