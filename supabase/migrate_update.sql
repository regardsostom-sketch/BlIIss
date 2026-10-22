-- Только если schema.sql был выполнен ДО этих обновлений (казахские названия, признак «раздел заполнен», загрузка видео и аудио).
alter table programs  add column if not exists title_kk text;
alter table topics    add column if not exists title_kk text;
alter table subtopics add column if not exists title_kk text;

alter table sections add column if not exists filled boolean not null default false;
update sections set filled = case kind
  when 'grammar'    then coalesce(jsonb_array_length(content->'gaps'), 0) > 0
  when 'vocabulary' then coalesce(jsonb_array_length(content->'words'), 0) > 0
  when 'reading'    then coalesce(jsonb_array_length(content->'questions'), 0) > 0
  when 'listening'  then coalesce(jsonb_array_length(content->'questions'), 0) > 0
  else coalesce(content->>'task', '') <> ''
end;

-- ---------- видео и аудио уроков (загружает преподаватель, смотрят все по ссылке) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media', 'media', true, 52428800,
  array['video/mp4','video/webm','video/ogg','audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/webm'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "staff uploads media" on storage.objects;
create policy "staff uploads media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_staff());
drop policy if exists "staff deletes media" on storage.objects;
create policy "staff deletes media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_staff());
