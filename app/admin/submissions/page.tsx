import Link from "next/link";
import AiReportView from "@/components/AiReport";
import type { AiReport } from "@/lib/ai";
import { requireStaff } from "@/lib/auth";
import { review } from "../actions";

type Row = {
  id: string; kind: string; text: string; audio_path: string | null; created_at: string;
  status: string; teacher_feedback: string | null; ai_report: AiReport | null;
  profiles: { name: string | null } | null; subtopics: { title: string } | null;
};

export default async function Submissions({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const done = (await searchParams).done === "1";
  const { sb } = await requireStaff();
  let q = sb.from("submissions").select("*, profiles(name), subtopics(title)");
  q = done
    ? q.neq("status", "pending").order("reviewed_at", { ascending: false }).limit(30)
    : q.eq("status", "pending").order("created_at");
  const [{ data }, { count }] = await Promise.all([
    q,
    sb.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const urls = await Promise.all(rows.map(async (r) => {
    if (!r.audio_path) return null;
    const { data: u } = await sb.storage.from("speaking").createSignedUrl(r.audio_path, 3600);
    return u?.signedUrl ?? null;
  }));
  const tab = (on: boolean) => `rounded-full border-2 px-4 py-2 font-bold ${on ? "border-pink-600 bg-pink-600 text-white" : "border-pink-200 bg-white text-stone-700"}`;
  const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  return (<div className="grid gap-4">
    <h1 className="text-3xl font-extrabold">Работы</h1>
    <nav className="flex gap-2">
      <Link href="/admin/submissions" className={tab(!done)}>На проверке ({count ?? 0})</Link>
      <Link href="/admin/submissions?done=1" className={tab(done)}>Проверенные</Link>
    </nav>
    {rows.map((r, i) => (
      <form key={r.id} action={review} className="grid gap-2 rounded-2xl border border-pink-200 bg-white p-5">
        <input type="hidden" name="id" value={r.id} />
        <p className="text-sm text-stone-500">{r.kind === "speaking" ? "Говорение" : "Письмо"} · {r.profiles?.name ?? "Студент"} · {r.subtopics?.title} · {when(r.created_at)}</p>
        {r.kind === "speaking"
          ? (urls[i] ? <audio controls src={urls[i]!} className="w-full" /> : <p className="text-red-700">Не удалось загрузить запись</p>)
          : <p className="whitespace-pre-wrap">{r.text}</p>}
        {r.ai_report && <AiReportView report={r.ai_report} lang="ru" />}
        <textarea name="feedback" rows={3} defaultValue={r.teacher_feedback ?? ""} className="rounded-xl border-2 border-pink-200 px-3 py-2" placeholder="Отзыв студенту" />
        <div className="flex gap-2">
          <select name="status" defaultValue={r.status === "revise" ? "revise" : "accepted"} className="rounded-xl border-2 border-pink-200 px-3 py-2"><option value="accepted">Принять</option><option value="revise">Доработать</option></select>
          <button className="rounded-xl bg-pink-600 px-5 py-2 font-bold text-white">{done ? "Изменить" : "Сохранить"}</button>
        </div>
      </form>))}
    {!rows.length && <p className="text-stone-500">{done ? "Проверенных работ пока нет." : "Новых работ нет."}</p>}
  </div>);
}
