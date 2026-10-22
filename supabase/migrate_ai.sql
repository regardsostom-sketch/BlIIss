-- Автопроверка письма и говорения. Выполните один раз в Supabase → SQL Editor.
alter table submissions add column if not exists ai_score int;      -- говорение: точность произношения, %
alter table submissions add column if not exists ai_report jsonb;   -- подробности автопроверки (пишет только сервер)

-- студент не может сам записать результат автопроверки: его пишет сервер через service_role
drop policy if exists "student adds own" on submissions;
create policy "student adds own" on submissions for insert
  with check (user_id = auth.uid() and status = 'pending' and ai_report is null and ai_score is null);
