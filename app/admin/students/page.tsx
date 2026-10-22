import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { daysSince, fetchAll, fmtDate, lastActivity, programData, summarize, type ProgAct, type ProgramData } from "@/lib/overview";
import { pctMap, type SubRow } from "@/lib/progress";
import type { Program, Subtopic, Topic } from "@/lib/types";
import { assignProgram } from "../actions";

type Student = { id: string; name: string | null; level: string | null; program_id: string | null };
type Work = SubRow & { user_id: string };

const PAGE = 20;
const INACTIVE_DAYS = 7;

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  rows.forEach((r) => { const k = key(r); const a = m.get(k); if (a) a.push(r); else m.set(k, [r]); });
  return m;
}

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const { q = "", p = "1" } = await searchParams;
  const { sb } = await requireStaff();
  const page = Math.max(1, parseInt(p, 10) || 1);
  const term = q.trim();

  let query = sb.from("profiles").select("id,name,level,program_id", { count: "exact" }).eq("role", "student");
  if (term) query = query.ilike("name", `%${term}%`);
  const { data: st, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const students = (st ?? []) as Student[];
  const total = count ?? students.length;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const ids = students.map((s) => s.id);
  const pids = [...new Set(students.map((s) => s.program_id).filter((x): x is string => !!x))];
  const { data: pr } = await sb.from("programs").select("id,level,title,published").order("level");
  const [prog, works, topics, subs, filled] = await Promise.all([
    fetchAll<ProgAct>((a, b) => sb.from("progress").select("user_id,subtopic_id,kind,pct,updated_at").in("user_id", ids).range(a, b)),
    fetchAll<Work>((a, b) => sb.from("submissions").select("user_id,subtopic_id,kind,status,created_at").in("user_id", ids).range(a, b)),
    fetchAll<Topic>((a, b) => sb.from("topics").select("*").in("program_id", pids).order("position").range(a, b)),
    fetchAll<Subtopic>((a, b) => sb.from("subtopics").select("*").in("program_id", pids).order("position").range(a, b)),
    fetchAll<{ subtopic_id: string; kind: string; program_id: string }>((a, b) => sb.from("sections").select("subtopic_id,kind,program_id").in("program_id", pids).eq("filled", true).range(a, b)),
  ]);
  const programs = (pr ?? []) as Pick<Program, "id" | "level" | "title" | "published">[];

  const progByUser = groupBy(prog, (r) => r.user_id), worksByUser = groupBy(works, (r) => r.user_id);
  const topicsBy = groupBy(topics, (r) => r.program_id), subsBy = groupBy(subs, (r) => r.program_id), filledBy = groupBy(filled, (r) => r.program_id);
  const dataOf = (pid: string): ProgramData => programData(topicsBy.get(pid) ?? [], subsBy.get(pid) ?? [], filledBy.get(pid) ?? []);
  const cache = new Map<string, ProgramData>();

  const href = (n: number) => `/admin/students?${new URLSearchParams({ ...(term ? { q: term } : {}), p: String(n) })}`;

  return (<div className="grid gap-4">
    <h1 className="text-3xl font-extrabold">Студенты ({total})</h1>
    <p className="text-stone-500">Процент считается по заполненным разделам программы студента. Студент выбирает уровень при регистрации; если выбрал неверно, назначьте ему другую программу.</p>
    <form className="flex gap-2">
      <input name="q" defaultValue={term} placeholder="Поиск по имени" className="min-w-0 flex-1 rounded-xl border-2 border-pink-200 bg-white px-4 py-2" />
      <button className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">Найти</button>
      {term && <Link href="/admin/students" className="rounded-xl border-2 border-pink-200 bg-white px-4 py-2 font-bold">Сбросить</Link>}
    </form>
    {students.map((s) => {
      let pd: ProgramData | null = null;
      if (s.program_id) { pd = cache.get(s.program_id) ?? dataOf(s.program_id); cache.set(s.program_id, pd); }
      const pr_ = progByUser.get(s.id) ?? [], wk = worksByUser.get(s.id) ?? [];
      const sum = pd && pd.topics.length ? summarize(pd, pctMap(pr_, wk)) : null;
      const last = lastActivity(pr_, wk);
      const idle = last === null ? null : daysSince(last);
      const pending = wk.filter((w) => w.status === "pending").length;
      return (
        <form key={s.id} action={assignProgram} className="grid gap-3 rounded-2xl border border-pink-200 bg-white p-4">
          <input type="hidden" name="student_id" value={s.id} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-40 flex-1">
              <Link href={`/admin/students/${s.id}`} className="text-lg font-bold text-pink-700 hover:underline">{s.name || "Без имени"}</Link><br />
              <span className="text-sm text-stone-500">выбрал уровень: {s.level ?? "—"}</span>
            </div>
            <div className="w-40">
              <div className="flex justify-between text-sm"><span className="text-stone-500">Прогресс</span><b>{sum ? `${sum.total}%` : "—"}</b></div>
              <div className="h-2 overflow-hidden rounded-full bg-pink-100"><div className="h-full rounded-full bg-pink-600" style={{ width: `${sum?.total ?? 0}%` }} /></div>
            </div>
            <div className="min-w-32 text-sm">
              <span className="text-stone-500">Последняя активность</span><br />
              {last === null ? <span className="text-stone-500">ещё не занимался</span> : <b>{fmtDate(last)}</b>}
            </div>
            <div className="flex flex-wrap gap-2">
              {idle !== null && idle >= INACTIVE_DAYS && <span className="rounded-full bg-amber-100 px-3 py-0.5 text-sm font-bold text-amber-800">{idle} дн. без занятий</span>}
              {pending > 0 && <Link href="/admin/submissions" className="rounded-full bg-pink-100 px-3 py-0.5 text-sm font-bold text-pink-800">на проверке: {pending}</Link>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select name="program_id" defaultValue={s.program_id ?? ""} required className="rounded-xl border-2 border-pink-200 bg-white px-3 py-2">
              {!s.program_id && <option value="" disabled>Программа не назначена</option>}
              {programs.map((x) => <option key={x.id} value={x.id}>{x.level} · {x.title}{x.published ? "" : " (черновик)"}</option>)}
            </select>
            <button className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">Назначить</button>
            <span className="flex-1" />
            <Link href={`/admin/students/${s.id}`} className="font-bold text-pink-700 hover:underline">Подробнее →</Link>
          </div>
        </form>);
    })}
    {!students.length && <p className="text-stone-500">{term ? "Никого не нашли." : "Студентов пока нет."}</p>}
    {pages > 1 && (
      <nav className="flex items-center justify-between">
        {page > 1 ? <Link href={href(page - 1)} className="font-bold text-pink-700">← Назад</Link> : <span />}
        <span className="text-sm text-stone-500">Страница {page} из {pages}</span>
        {page < pages ? <Link href={href(page + 1)} className="font-bold text-pink-700">Дальше →</Link> : <span />}
      </nav>)}
  </div>);
}
