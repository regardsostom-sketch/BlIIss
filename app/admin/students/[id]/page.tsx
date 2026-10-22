import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { daysSince, fetchAll, fmtDate, fmtDateTime, lastActivity, programData, summarize, type ProgAct } from "@/lib/overview";
import { pctMap } from "@/lib/progress";
import { KIND_RU, type Kind, type Program, type Subtopic, type Topic } from "@/lib/types";

type Work = {
  id: string; subtopic_id: string; kind: string; text: string; audio_path: string | null;
  status: string; teacher_feedback: string | null; created_at: string;
};

const STATUS_RU: Record<string, string> = { pending: "Ждёт проверки", accepted: "Принято", revise: "На доработку" };
const STATUS_CLS: Record<string, string> = { pending: "bg-pink-100 text-pink-800", accepted: "bg-green-100 text-green-800", revise: "bg-amber-100 text-amber-800" };
const SHORT: Record<Kind, string> = { grammar: "Грам.", vocabulary: "Лекс.", listening: "Ауд.", reading: "Чт.", writing: "Письмо", speaking: "Говор." };
const GRID = "grid grid-cols-[minmax(9rem,1fr)_repeat(6,3.6rem)_3.4rem] items-center gap-1";
const WEAK_BELOW = 70;
const INACTIVE_DAYS = 7;
const WORKS_SHOWN = 30;

const cell = (pct: number) => pct >= 100 ? "bg-green-100 text-green-800" : pct >= WEAK_BELOW ? "bg-pink-100 text-pink-800" : pct > 0 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireStaff();
  const { data: st } = await sb.from("profiles").select("id,name,level,program_id,role,created_at").eq("id", id).maybeSingle();
  if (!st || st.role !== "student") notFound();
  const pid = st.program_id as string | null;

  const [prog, works, progRes, topics, subs, filled] = await Promise.all([
    fetchAll<ProgAct>((a, b) => sb.from("progress").select("user_id,subtopic_id,kind,pct,updated_at").eq("user_id", id).range(a, b)),
    fetchAll<Work>((a, b) => sb.from("submissions").select("id,subtopic_id,kind,text,audio_path,status,teacher_feedback,created_at").eq("user_id", id).order("created_at", { ascending: false }).range(a, b)),
    pid ? sb.from("programs").select("id,level,title,published").eq("id", pid).maybeSingle() : Promise.resolve({ data: null }),
    pid ? fetchAll<Topic>((a, b) => sb.from("topics").select("*").eq("program_id", pid).order("position").range(a, b)) : Promise.resolve([] as Topic[]),
    pid ? fetchAll<Subtopic>((a, b) => sb.from("subtopics").select("*").eq("program_id", pid).order("position").range(a, b)) : Promise.resolve([] as Subtopic[]),
    pid ? fetchAll<{ subtopic_id: string; kind: string }>((a, b) => sb.from("sections").select("subtopic_id,kind").eq("program_id", pid).eq("filled", true).range(a, b)) : Promise.resolve([] as { subtopic_id: string; kind: string }[]),
  ]);
  const program = progRes.data as Pick<Program, "id" | "level" | "title" | "published"> | null;
  const sum = program ? summarize(programData(topics, subs, filled), pctMap(prog, works)) : null;
  const last = lastActivity(prog, works);
  const idle = last === null ? null : daysSince(last);

  const titleOf = new Map(subs.map((s) => [s.id, s.title]));
  // works отсортированы от новых к старым, поэтому первая работа по разделу и есть последняя
  const latest = new Map<string, Work>();
  works.forEach((w) => { const k = `${w.subtopic_id}:${w.kind}`; if (!latest.has(k)) latest.set(k, w); });
  const revise = [...latest.values()].filter((w) => w.status === "revise");
  const pending = works.filter((w) => w.status === "pending");
  // слабые места: автопроверяемые разделы, где лучший результат ниже порога (письмо и говорение оценивает преподаватель)
  const weak = (sum?.topics ?? []).flatMap((t) => t.subs.flatMap((s) => s.kinds
    .filter((k) => k.kind !== "writing" && k.kind !== "speaking" && k.pct > 0 && k.pct < WEAK_BELOW)
    .map((k) => ({ sid: s.id, title: s.title, kind: k.kind, pct: k.pct }))));
  const attention = revise.length + weak.length;

  const shown = works.slice(0, WORKS_SHOWN);
  const urls = await Promise.all(shown.map(async (w) => {
    if (!w.audio_path) return null;
    const { data } = await sb.storage.from("speaking").createSignedUrl(w.audio_path, 3600);
    return data?.signedUrl ?? null;
  }));

  return (<div className="grid gap-5">
    <div>
      <Link href="/admin/students" className="font-bold text-pink-700">← Все студенты</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{st.name || "Без имени"}</h1>
      <p className="text-stone-500">Выбрал уровень: {st.level ?? "—"} · зарегистрирован {fmtDate(Date.parse(st.created_at))}</p>
    </div>

    <section className="grid gap-3 rounded-2xl border border-pink-200 bg-white p-5 sm:grid-cols-3">
      <div>
        <p className="text-sm text-stone-500">Программа</p>
        <p className="font-bold">{program ? `${program.level} · ${program.title}` : pid ? "Недоступна вам (черновик другого преподавателя)" : "Не назначена"}</p>
      </div>
      <div>
        <p className="text-sm text-stone-500">Пройдено</p>
        <p className="text-2xl font-extrabold">{sum ? `${sum.total}%` : "—"}</p>
        <div className="h-2 overflow-hidden rounded-full bg-pink-100"><div className="h-full rounded-full bg-pink-600" style={{ width: `${sum?.total ?? 0}%` }} /></div>
      </div>
      <div>
        <p className="text-sm text-stone-500">Последняя активность</p>
        <p className="font-bold">{last === null ? "ещё не занимался" : fmtDate(last)}</p>
        {idle !== null && idle >= INACTIVE_DAYS && <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-sm font-bold text-amber-800">{idle} дн. без занятий</span>}
      </div>
    </section>

    <section className="grid gap-3 rounded-2xl border border-pink-200 bg-white p-5">
      <h2 className="text-xl font-bold">Что обсудить на следующем занятии</h2>
      {!attention && !pending.length && <p className="text-stone-500">{sum ? "Пока всё в порядке: слабых мест и работ на доработку нет." : "Данных пока нет."}</p>}
      {pending.length > 0 && <p><Link href="/admin/submissions" className="font-bold text-pink-700 hover:underline">Ждут вашей проверки: {pending.length} →</Link></p>}
      {revise.length > 0 && (<div>
        <p className="font-bold">Работы на доработке</p>
        <ul className="list-disc pl-5">{revise.map((w) => <li key={w.id}>{titleOf.get(w.subtopic_id) ?? "Подтема"}: {KIND_RU[w.kind as Kind] ?? w.kind}</li>)}</ul>
      </div>)}
      {weak.length > 0 && (<div>
        <p className="font-bold">Слабые места (лучший результат ниже {WEAK_BELOW}%)</p>
        <ul className="list-disc pl-5">{weak.map((w) => <li key={`${w.sid}:${w.kind}`}>{w.title}: {KIND_RU[w.kind]}, {w.pct}%</li>)}</ul>
        <p className="mt-1 text-sm text-stone-500">Сайт хранит только лучший процент по разделу, а не ответы на отдельные вопросы, поэтому конкретные ошибки отсюда не видны.</p>
      </div>)}
    </section>

    {sum && (
      <section className="grid gap-4 overflow-x-auto rounded-2xl border border-pink-200 bg-white p-5">
        <h2 className="text-xl font-bold">Прогресс по темам</h2>
        <div className="grid min-w-[36rem] gap-5">
          {sum.topics.map((t, ti) => (
            <div key={t.id} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-bold">{ti + 1}. {t.title}</h3>
                <span className="text-sm text-stone-500">{t.live ? `${t.pct}%` : "нет заполненных разделов"}</span>
              </div>
              {ti === 0 && (
                <div className={`${GRID} text-xs font-bold text-stone-500`} aria-hidden>
                  <span />{(Object.keys(SHORT) as Kind[]).map((k) => <span key={k} className="text-center" title={KIND_RU[k]}>{SHORT[k]}</span>)}<span className="text-center">Итого</span>
                </div>)}
              {t.subs.map((s, si) => (
                <div key={s.id} className={GRID}>
                  <span className="truncate" title={s.title}>{ti + 1}.{si + 1} {s.title}</span>
                  {(Object.keys(SHORT) as Kind[]).map((k) => {
                    const c = s.kinds.find((x) => x.kind === k);
                    return c
                      ? <span key={k} title={KIND_RU[k]} className={`rounded-md py-0.5 text-center text-sm font-bold ${cell(c.pct)}`}>{c.pct}%</span>
                      : <span key={k} title={`${KIND_RU[k]}: раздел не заполнен`} className="text-center text-stone-300">—</span>;
                  })}
                  <span className="text-center font-bold">{s.kinds.length ? `${s.pct}%` : "—"}</span>
                </div>))}
              {!t.subs.length && <p className="text-sm text-stone-500">Подтем пока нет.</p>}
            </div>))}
          {!sum.topics.length && <p className="text-stone-500">В программе пока нет тем.</p>}
        </div>
        <p className="text-sm text-stone-500">Письмо и говорение: 50% пока работа ждёт проверки, 100% после «Принять», 0% если отправлена на доработку.</p>
      </section>)}

    <section className="grid gap-3">
      <h2 className="text-xl font-bold">Письменные и устные работы ({works.length})</h2>
      {shown.map((w, i) => (
        <div key={w.id} className="grid gap-2 rounded-2xl border border-pink-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <b className="text-stone-900">{w.kind === "speaking" ? "Говорение" : "Письмо"}</b>
            <span>· {titleOf.get(w.subtopic_id) ?? "Подтема"}</span>
            <span>· {fmtDateTime(w.created_at)}</span>
            <span className={`rounded-full px-3 py-0.5 font-bold ${STATUS_CLS[w.status] ?? ""}`}>{STATUS_RU[w.status] ?? w.status}</span>
          </div>
          {w.kind === "speaking"
            ? (urls[i] ? <audio controls src={urls[i]!} className="w-full" /> : <p className="text-red-700">Не удалось загрузить запись</p>)
            : <p className="whitespace-pre-wrap">{w.text}</p>}
          {w.teacher_feedback && <p className="rounded-xl bg-pink-50 p-3"><b>Отзыв:</b> {w.teacher_feedback}</p>}
        </div>))}
      {works.length > WORKS_SHOWN && <p className="text-sm text-stone-500">Показаны последние {WORKS_SHOWN} работ.</p>}
      {!works.length && <p className="text-stone-500">Студент пока ничего не сдавал.</p>}
    </section>
  </div>);
}
