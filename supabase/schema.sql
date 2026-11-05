-- Apply only to the dedicated Supabase project for «тише.»
-- Each account owns one app document; RLS isolates documents by auth.uid().
create table if not exists public.tishe_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.tishe_state enable row level security;
revoke all on public.tishe_state from anon;
grant select, insert, update, delete on public.tishe_state to authenticated;

drop policy if exists "tishe_select_own_state" on public.tishe_state;
drop policy if exists "tishe_insert_own_state" on public.tishe_state;
drop policy if exists "tishe_update_own_state" on public.tishe_state;
drop policy if exists "tishe_delete_own_state" on public.tishe_state;
create policy "tishe_select_own_state" on public.tishe_state
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tishe_insert_own_state" on public.tishe_state
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "tishe_update_own_state" on public.tishe_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tishe_delete_own_state" on public.tishe_state
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Photos are private and stored under <user-id>/<photo-id>.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tishe-photos', 'tishe-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "tishe_photos_read_own" on storage.objects;
drop policy if exists "tishe_photos_insert_own" on storage.objects;
drop policy if exists "tishe_photos_delete_own" on storage.objects;
create policy "tishe_photos_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'tishe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tishe_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tishe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tishe_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tishe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
