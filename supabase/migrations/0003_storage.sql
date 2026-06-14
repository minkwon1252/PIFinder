-- =============================================================================
-- PIFinder — private storage bucket for CV / project documents.
-- CV uploads MUST be private. Files are stored under a per-user folder:
--   cvs/<auth.uid()>/<filename>
-- RLS on storage.objects restricts access to the owning user (+ admins).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do update set public = false;

-- Owner can read their own files (first path segment must equal their uid).
drop policy if exists cvs_owner_read on storage.objects;
create policy cvs_owner_read on storage.objects
  for select using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists cvs_owner_insert on storage.objects;
create policy cvs_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists cvs_owner_update on storage.objects;
create policy cvs_owner_update on storage.objects
  for update using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists cvs_owner_delete on storage.objects;
create policy cvs_owner_delete on storage.objects
  for delete using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins may read CVs (e.g. for support). Admin reads should still be audited
-- at the application layer.
drop policy if exists cvs_admin_read on storage.objects;
create policy cvs_admin_read on storage.objects
  for select using (bucket_id = 'cvs' and public.is_admin());
