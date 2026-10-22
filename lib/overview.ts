import { KINDS, type Kind, type Subtopic, type Topic } from "./types";
import { avg, subtopicPct, type ProgRow } from "./progress";

// Помощники для экранов преподавателя: сводка прогресса студента по программе.
// Проценты считаются так же, как в кабинете студента (app/cabinet/page.tsx), чтобы цифры совпадали.

export type ProgAct = ProgRow & { user_id: string; updated_at: string };

// PostgREST отдаёт за запрос ограниченное число строк (в Supabase Cloud по умолчанию 1000), поэтому читаем порциями
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0, i = 0; i < 500; i++) {
    const { data } = await page(from, from + 999);
    const rows = (data ?? []) as T[];
    if (!rows.length) break;
    out.push(...rows);
    from += rows.length;
  }
  return out;
}

export type ProgramData = { topics: Topic[]; subs: Subtopic[]; filled: Record<string, Kind[]> };

export function programData(topics: Topic[], subs: Subtopic[], filledRows: { subtopic_id: string; kind: string }[]): ProgramData {
  const filled: Record<string, Kind[]> = {};
  filledRows.forEach((r) => { (filled[r.subtopic_id] ||= []).push(r.kind as Kind); });
  return { topics, subs, filled };
}

export type SubSummary = { id: string; title: string; pct: number; kinds: { kind: Kind; pct: number }[] };
export type TopicSummary = { id: string; title: string; pct: number; live: boolean; subs: SubSummary[] };
export type Summary = { total: number; topics: TopicSummary[] };

// m: ключ "<subtopic_id>:<kind>" → процент (см. pctMap в lib/progress.ts)
export function summarize(d: ProgramData, m: Record<string, number>): Summary {
  const kindsOf = (sid: string) => d.filled[sid] ?? [];
  const topics: TopicSummary[] = d.topics.map((tp) => {
    const subs: SubSummary[] = d.subs.filter((s) => s.topic_id === tp.id).map((s) => ({
      id: s.id, title: s.title, pct: subtopicPct(m, s.id, kindsOf(s.id)),
      kinds: KINDS.filter((k) => kindsOf(s.id).includes(k)).map((k) => ({ kind: k, pct: m[`${s.id}:${k}`] ?? 0 })),
    }));
    const live = subs.filter((s) => s.kinds.length > 0);
    return { id: tp.id, title: tp.title, pct: avg(live.map((s) => s.pct)), live: live.length > 0, subs };
  });
  return { total: avg(topics.filter((t) => t.live).map((t) => t.pct)), topics };
}

// Последняя активность студента: время последнего ответа в упражнениях или сдачи работы
export function lastActivity(progress: { updated_at: string }[], works: { created_at: string }[]): number | null {
  const times = [...progress.map((p) => Date.parse(p.updated_at)), ...works.map((w) => Date.parse(w.created_at))].filter((n) => !Number.isNaN(n));
  return times.length ? Math.max(...times) : null;
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Almaty" });
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });
export const fmtDate = (ms: number) => dateFmt.format(ms);
export const fmtDateTime = (iso: string) => dateTimeFmt.format(Date.parse(iso));
export const daysSince = (ms: number) => Math.floor((Date.now() - ms) / 86_400_000);
