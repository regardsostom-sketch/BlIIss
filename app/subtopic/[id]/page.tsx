import Link from "next/link";
import { notFound } from "next/navigation";
import Cards from "@/components/Cards";
import Gaps from "@/components/Gaps";
import Listen from "@/components/Listen";
import Quiz from "@/components/Quiz";
import Speaking from "@/components/Speaking";
import Video from "@/components/Video";
import AiReportView from "@/components/AiReport";
import Writing from "@/components/Writing";
import type { AiReport } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { loc, STATUS_KEY } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { pctMap, type ProgRow, type SubRow } from "@/lib/progress";
import { KINDS, type Content, type Kind } from "@/lib/types";

type Rel = { title: string; title_kk: string | null };

export default async function SubtopicPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const { id } = await params;
  const { s } = await searchParams;
  const kind: Kind = KINDS.includes(s as Kind) ? (s as Kind) : "grammar";
  const { sb, user } = await requireUser();
  const { lang, t } = await getT();
  const { data: sub } = await sb.from("subtopics").select("id,title,title_kk,topic_id,topics(title,title_kk)").eq("id", id).maybeSingle();
  if (!sub) notFound();
  const rel = sub.topics as Rel | Rel[] | null;
  const topic = Array.isArray(rel) ? rel[0] : rel;
  const [{ data: secs }, { data: prog }, { data: works }] = await Promise.all([
    sb.from("sections").select("kind,content,filled").eq("subtopic_id", id),
    sb.from("progress").select("subtopic_id,kind,pct").eq("subtopic_id", id).eq("user_id", user.id),
    sb.from("submissions").select("subtopic_id,kind,status,teacher_feedback,text,audio_path,created_at,ai_report").eq("subtopic_id", id).eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const m = pctMap((prog ?? []) as ProgRow[], (works ?? []) as SubRow[]);
  const c = ((secs ?? []).find((x) => x.kind === kind)?.content ?? {}) as Content;
  const best = m[`${id}:${kind}`] ?? 0;
  const last = (works ?? []).find((x) => x.kind === kind) ?? null;
  const lastSub = last ? { status: last.status as string, teacher_feedback: (last.teacher_feedback ?? null) as string | null } : null;
  // история отправок студента по этому разделу (новые сверху) и ссылки на его записи
  const history = (works ?? []).filter((x) => x.kind === kind && (kind === "writing" || kind === "speaking"));
  const audioUrls = await Promise.all(history.map(async (h) => {
    if (!h.audio_path) return null;
    const { data: u } = await sb.storage.from("speaking").createSignedUrl(h.audio_path, 3600);
    return u?.signedUrl ?? null;
  }));
  // если преподаватель вернул письмо на доработку, подставляем прошлый текст
  const draft = last?.status === "revise" && kind === "writing" ? ((last as { text?: string }).text ?? "") : "";
  const when = (iso: string) => new Date(iso).toLocaleString(lang === "kk" ? "kk-KZ" : "ru-RU", { dateStyle: "short", timeStyle: "short" });
  const explanation = loc(lang, c.explanation, c.explanation_kk);
  const task = loc(lang, c.task, c.task_kk);
  return (<div className="grid gap-5">
    <div>
      <Link href="/cabinet" className="font-bold text-pink-700">{t("back_program")}</Link>
      <p className="mt-3 text-stone-500">{topic ? loc(lang, topic.title, topic.title_kk) : ""}</p>
      <h1 className="text-3xl font-extrabold">{loc(lang, sub.title, sub.title_kk)}</h1>
    </div>
    <nav className="flex flex-wrap gap-2">
      {KINDS.map((k) => {
        const p = m[`${id}:${k}`] ?? 0;
        const has = (secs ?? []).some((x) => x.kind === k && x.filled);
        return <Link key={k} href={`/subtopic/${id}?s=${k}`} className={`rounded-full border-2 px-4 py-2 font-bold ${has ? "" : "opacity-50"} ${k === kind ? "border-pink-600 bg-pink-600 text-white" : "border-pink-200 bg-white text-stone-700"}`}>{t(`kind_${k}`)}{p >= 100 ? " ✓" : p > 0 ? ` ${p}%` : ""}</Link>;
      })}
    </nav>
    <section className="grid gap-4 rounded-2xl border border-pink-200 bg-white p-5">
      <h2 className="text-xl font-bold">{t(`kind_${kind}`)}</h2>
      {kind === "grammar" && <>
        <Video url={c.video_url} />
        {explanation && <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-4">{explanation}</p>}
        <Gaps key={kind} subtopicId={id} gaps={c.gaps ?? []} best={best} /></>}
      {kind === "vocabulary" && <Cards subtopicId={id} words={c.words ?? []} best={best} />}
      {kind === "listening" && <>
        {c.video_url
          ? <><Video url={c.video_url} />
              {c.text && <details className="rounded-2xl bg-pink-50 p-4"><summary className="cursor-pointer font-bold text-pink-700">{t("show_text")}</summary><p className="mt-2 whitespace-pre-wrap">{c.text}</p></details>}</>
          : <Listen audioUrl={c.audio_url || undefined} text={c.text} />}
        <Quiz subtopicId={id} kind="listening" questions={c.questions ?? []} best={best} /></>}
      {kind === "reading" && <>
        {c.text && <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-4 text-lg">{c.text}</p>}
        <Quiz subtopicId={id} kind="reading" questions={c.questions ?? []} best={best} /></>}
      {kind === "writing" && <>
        <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-4">{task || t("task_missing")}</p>
        <Writing key={draft} subtopicId={id} last={lastSub} draft={draft} /></>}
      {kind === "speaking" && <>
        <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-4">{task || t("task_missing")}</p>
        <Speaking subtopicId={id} last={lastSub} readText={c.read_text || undefined} /></>}
    </section>
    {history.length > 0 && <section className="grid gap-3 rounded-2xl border border-pink-200 bg-white p-5">
      <h2 className="text-xl font-bold">{t("works_history")}</h2>
      {history.map((h, i) => (
        <div key={`${h.created_at}-${i}`} className="grid gap-2 rounded-xl border border-pink-100 p-4">
          <p className="text-sm text-stone-500">{when(h.created_at)} · <b className="text-pink-700">{t(STATUS_KEY[h.status as string])}</b></p>
          {h.kind === "speaking"
            ? (audioUrls[i] ? <audio controls src={audioUrls[i]!} className="w-full" /> : null)
            : <p className="whitespace-pre-wrap">{h.text}</p>}
          {h.ai_report && <AiReportView report={h.ai_report as AiReport} />}
          {h.teacher_feedback && <p className="rounded-xl bg-pink-50 p-3"><b>{t("teacher_label")}:</b> {h.teacher_feedback}</p>}
        </div>))}
    </section>}
  </div>);
}
