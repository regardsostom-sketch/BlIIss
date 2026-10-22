import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loc, STATUS_KEY } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { avg, pctMap, subtopicPct, type ProgRow, type SubRow } from "@/lib/progress";
import type { Kind, Program, Subtopic, Topic } from "@/lib/types";

const Bar = ({ pct }: { pct: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-pink-100"><div className="h-full rounded-full bg-pink-600" style={{ width: `${pct}%` }} /></div>);

export default async function Cabinet() {
  const { sb, user, me } = await requireUser();
  const { lang, t } = await getT();
  const L = (ru: string, kk: string | null) => loc(lang, ru, kk);
  if (!me) return <p className="text-stone-500">{t("no_profile")}</p>;
  if (me.role !== "student") redirect("/admin");
  if (!me.program_id) return (
    <div className="mx-auto max-w-xl rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{t("hello")}{me.name ? `, ${me.name}` : ""}!</h1>
      <p className="mt-2 text-stone-600">{t("no_program", { level: me.level ?? "—" })}</p>
    </div>);
  const { data: program } = await sb.from("programs").select("*").eq("id", me.program_id).maybeSingle();
  if (!program) return <p className="text-stone-500">{t("program_unavailable")}</p>;
  const [{ data: topics }, { data: subs }, { data: prog }, { data: works }, { data: fl }] = await Promise.all([
    sb.from("topics").select("*").eq("program_id", me.program_id).order("position"),
    sb.from("subtopics").select("*").eq("program_id", me.program_id).order("position"),
    sb.from("progress").select("subtopic_id,kind,pct").eq("user_id", user.id),
    sb.from("submissions").select("subtopic_id,kind,status,teacher_feedback,reviewed_at,created_at").eq("user_id", user.id),
    sb.from("sections").select("subtopic_id,kind").eq("program_id", me.program_id).eq("filled", true),
  ]);
  const m = pctMap((prog ?? []) as ProgRow[], (works ?? []) as SubRow[]);
  const T = (topics ?? []) as Topic[]; const S = (subs ?? []) as Subtopic[];
  // считаем только разделы, в которых преподаватель уже что-то добавил
  const filled: Record<string, Kind[]> = {};
  ((fl ?? []) as { subtopic_id: string; kind: string }[]).forEach((r) => { (filled[r.subtopic_id] ||= []).push(r.kind as Kind); });
  const kindsOf = (sid: string) => filled[sid] ?? [];
  const sPct = (sid: string) => subtopicPct(m, sid, kindsOf(sid));
  const subsOf = (tid: string) => S.filter((s) => s.topic_id === tid);
  const liveSubs = (tid: string) => subsOf(tid).filter((s) => kindsOf(s.id).length > 0);
  const topicPct = (tid: string) => avg(liveSubs(tid).map((s) => sPct(s.id)));
  const total = avg(T.filter((x) => liveSubs(x.id).length > 0).map((x) => topicPct(x.id)));
  const next = T.flatMap((x) => liveSubs(x.id)).find((s) => sPct(s.id) < 100);
  const prg = program as Program;
  // свежие отзывы: по каждому разделу берём последнюю работу, если она уже проверена
  type Work = SubRow & { teacher_feedback: string | null; reviewed_at: string | null };
  const lastWork: Record<string, Work> = {};
  ((works ?? []) as Work[]).forEach((w) => {
    const k = `${w.subtopic_id}:${w.kind}`;
    if (!lastWork[k] || lastWork[k].created_at < w.created_at) lastWork[k] = w;
  });
  const feedback = Object.values(lastWork)
    .filter((w) => w.status !== "pending" && S.some((x) => x.id === w.subtopic_id))
    .sort((a, b) => (b.reviewed_at ?? b.created_at).localeCompare(a.reviewed_at ?? a.created_at))
    .slice(0, 5);
  return (<div className="grid gap-6">
    <div className="rounded-2xl border border-pink-200 bg-white p-6">
      <p className="font-bold text-pink-700">{prg.level} · {L(prg.title, prg.title_kk)}</p>
      <h1 className="text-3xl font-extrabold">{t("hello")}{me.name ? `, ${me.name}` : ""}!</h1>
      <p className="mb-2 mt-1 text-stone-500">{t("progress_total", { pct: total })}</p><Bar pct={total} />
      {next && <Link href={`/subtopic/${next.id}`} className="mt-4 inline-block rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("continue", { title: L(next.title, next.title_kk) })}</Link>}
    </div>
    {feedback.length > 0 && <section className="grid gap-3 rounded-2xl border border-pink-200 bg-white p-5">
      <h2 className="text-xl font-bold">{t("feedback_title")}</h2>
      {feedback.map((w) => {
        const st = S.find((x) => x.id === w.subtopic_id)!;
        return (
          <Link key={`${w.subtopic_id}:${w.kind}`} href={`/subtopic/${w.subtopic_id}?s=${w.kind}`} className={`grid gap-1 rounded-xl border-2 p-4 hover:bg-pink-50 ${w.status === "revise" ? "border-amber-300" : "border-pink-100"}`}>
            <span className="text-sm text-stone-500">{t(`kind_${w.kind as Kind}`)} · {L(st.title, st.title_kk)}</span>
            <span className={`font-bold ${w.status === "revise" ? "text-amber-700" : "text-green-700"}`}>{t(STATUS_KEY[w.status])}</span>
            {w.teacher_feedback && <span className="whitespace-pre-wrap">{w.teacher_feedback}</span>}
            <span className="text-sm font-bold text-pink-700">{t("open_work")}</span>
          </Link>);
      })}
    </section>}
    {!T.length && <p className="text-stone-500">{t("no_topics")}</p>}
    {T.map((tp, ti) => (
      <details key={tp.id} open={next?.topic_id === tp.id} className="rounded-2xl border border-pink-200 bg-white p-5">
        <summary className="grid cursor-pointer gap-2">
          <span className="text-xl font-bold">{ti + 1}. {L(tp.title, tp.title_kk)} <span className="text-base font-normal text-stone-500">· {topicPct(tp.id)}%</span></span>
          <Bar pct={topicPct(tp.id)} />
        </summary>
        <ul className="mt-4 grid gap-2">
          {subsOf(tp.id).map((s, si) => (
            <li key={s.id}>
              <Link href={`/subtopic/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-pink-100 px-4 py-3 hover:bg-pink-50">
                <span className="font-bold">{ti + 1}.{si + 1} {L(s.title, s.title_kk)}</span>
                <span className="flex-1" />
                <span className="flex gap-1" aria-hidden>
                  {kindsOf(s.id).map((k) => <i key={k} title={t(`kind_${k}`)} className={`h-3 w-3 rounded-full ${(m[`${s.id}:${k}`] ?? 0) >= 100 ? "bg-pink-600" : (m[`${s.id}:${k}`] ?? 0) > 0 ? "bg-pink-300" : "bg-pink-100"}`} />)}
                </span>
                <span className="w-14 text-right text-sm text-stone-500">{kindsOf(s.id).length ? `${sPct(s.id)}%` : t("soon")}</span>
              </Link>
            </li>))}
          {!subsOf(tp.id).length && <li className="text-stone-500">{t("no_subtopics")}</li>}
        </ul>
      </details>))}
  </div>);
}
