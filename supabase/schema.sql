-- BLISS Academy. Выполните целиком в Supabase → SQL Editor на ЧИСТОМ проекте.
-- (если уже запускали прежнюю версию, сначала: drop schema public cascade; create schema public;
--  и выдайте права: grant usage on schema public to anon, authenticated, service_role;
--  grant all on all tables in schema public to anon, authenticated, service_role;)

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  level text,                      -- уровень, который студент выбрал при регистрации
  role text not null default 'student' check (role in ('student','teacher','admin')),
  program_id uuid,                 -- программа студента (назначается автоматически по уровню, меняет преподаватель)
  created_at timestamptz not null default now()
);
create table programs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('A1','A2','B1','B2','C1')),
  title text not null,
  title_kk text,                   -- название по-казахски (необязательно)
  descr text,
  owner uuid references profiles(id) on delete set null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table profiles add constraint profiles_program_fk foreign key (program_id) references programs(id) on delete set null;

create table topics (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs on delete cascade,
  position int not null default 0,
  title text not null,
  title_kk text
);
create table subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics on delete cascade,
  program_id uuid not null references programs on delete cascade,  -- заполняется триггером из темы
  position int not null default 0,
  title text not null,
  title_kk text
);
create table sections (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references subtopics on delete cascade,
  program_id uuid not null references programs on delete cascade,
  kind text not null check (kind in ('grammar','vocabulary','listening','reading','writing','speaking')),
  content jsonb not null default '{}',
  filled boolean not null default false,   -- есть ли в разделе что пройти или сдать (ставит конструктор)
  unique (subtopic_id, kind)
);
create table progress (
  user_id uuid not null references profiles on delete cascade,
  subtopic_id uuid not null references subtopics on delete cascade,
  kind text not null,
  pct int not null check (pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, subtopic_id, kind)
);
create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  subtopic_id uuid not null references subtopics on delete cascade,
  kind text not null check (kind in ('writing','speaking')),
  text text not null default '',
  audio_path text,
  status text not null default 'pending' check (status in ('pending','accepted','revise')),
  teacher_feedback text,
  reviewed_at timestamptz,
  ai_score int,        -- говорение: точность произношения, %
  ai_report jsonb,     -- подробности автопроверки (пишет только сервер)
  created_at timestamptz not null default now()
);
create index on topics (program_id, position);
create index on subtopics (topic_id, position);
create index on subtopics (program_id);
create index on submissions (status, created_at);

-- ---------- функции ----------
create function is_staff() returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('teacher','admin')) $$;
create function is_admin() returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create function can_edit_program(pid uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from programs p where p.id = pid and ((p.owner = auth.uid() and is_staff()) or is_admin())) $$;

-- новый пользователь: профиль + программа по выбранному уровню (роль всегда student)
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare lvl text := new.raw_user_meta_data->>'level'; pid uuid;
begin
  if lvl is not null and lvl not in ('A1','A2','B1','B2','C1') then lvl := null; end if;
  select id into pid from programs where level = lvl and published order by created_at limit 1;
  insert into profiles (id, name, level, program_id) values (new.id, new.raw_user_meta_data->>'name', lvl, pid);
  return new;
end $$;
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();

-- преподаватель меняет программу студента
create function assign_program(uid uuid, pid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  update profiles set program_id = pid where id = uid and role = 'student';
end $$;

-- публикация программы: студентам этого уровня без программы она назначается
create function publish_program(pid uuid, flag boolean) returns void language plpgsql security definer set search_path = public as $$
declare lvl text;
begin
  if not can_edit_program(pid) then raise exception 'forbidden'; end if;
  update programs set published = flag where id = pid returning level into lvl;
  if flag then
    update profiles set program_id = pid where program_id is null and role = 'student' and level = lvl;
  end if;
end $$;

-- подтема наследует program_id от темы и получает 6 разделов
create function set_subtopic_program() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select program_id into new.program_id from topics where id = new.topic_id;
  return new;
end $$;
create trigger subtopic_program before insert on subtopics for each row execute function set_subtopic_program();
create function create_sections() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into sections (subtopic_id, program_id, kind)
  select new.id, new.program_id, k from unnest(array['grammar','vocabulary','listening','reading','writing','speaking']) as k;
  return new;
end $$;
create trigger subtopic_sections after insert on subtopics for each row execute function create_sections();

-- ---------- безопасность (RLS) ----------
alter table profiles enable row level security;
alter table programs enable row level security;
alter table topics enable row level security;
alter table subtopics enable row level security;
alter table sections enable row level security;
alter table progress enable row level security;
alter table submissions enable row level security;

-- роль и программу нельзя менять с клиента: UPDATE-политики для profiles нет
create policy "own profile or staff" on profiles for select using (id = auth.uid() or is_staff());

create policy "read programs" on programs for select using (published or owner = auth.uid() or is_admin());
create policy "staff add program" on programs for insert with check (is_staff() and owner = auth.uid());
create policy "owner edit program" on programs for update using (can_edit_program(id));
create policy "owner delete program" on programs for delete using (can_edit_program(id));

create policy "read topics" on topics for select using (exists (select 1 from programs p where p.id = program_id));
create policy "write topics" on topics for all using (can_edit_program(program_id)) with check (can_edit_program(program_id));
create policy "read subtopics" on subtopics for select using (exists (select 1 from programs p where p.id = program_id));
create policy "write subtopics" on subtopics for all using (can_edit_program(program_id)) with check (can_edit_program(program_id));
create policy "read sections" on sections for select using (exists (select 1 from programs p where p.id = program_id));
create policy "edit sections" on sections for update using (can_edit_program(program_id)) with check (can_edit_program(program_id));

create policy "own progress" on progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff read progress" on progress for select using (is_staff());

create policy "student adds own" on submissions for insert with check (user_id = auth.uid() and status = 'pending' and ai_report is null and ai_score is null);
create policy "read own or staff" on submissions for select using (user_id = auth.uid() or is_staff());
create policy "staff review" on submissions for update using (is_staff());

-- ---------- аудиозаписи (Говорение) ----------
insert into storage.buckets (id, name, public) values ('speaking', 'speaking', false) on conflict (id) do nothing;
create policy "student uploads own audio" on storage.objects for insert to authenticated
  with check (bucket_id = 'speaking' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or staff audio" on storage.objects for select to authenticated
  using (bucket_id = 'speaking' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- видео и аудио уроков (загружает преподаватель, смотрят все по ссылке) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media', 'media', true, 52428800,
  array['video/mp4','video/webm','video/ogg','audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','audio/webm'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
create policy "staff uploads media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_staff());
create policy "staff deletes media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_staff());

-- Первого админа назначьте вручную после регистрации:
--   update profiles set role = 'admin' where id = '<uuid>';
-- Преподавателям: role = 'teacher'.
