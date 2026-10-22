import { KINDS } from "./types";
export type ProgRow = { subtopic_id: string; kind: string; pct: number };
export type SubRow = { subtopic_id: string; kind: string; status: string; created_at: string };

// ключ "<subtopic_id>:<kind>" → процент. Письмо и говорение считаются по последней работе: принято 100, на проверке 50.
export function pctMap(progress: ProgRow[], subs: SubRow[]): Record<string, number> {
  const m: Record<string, number> = {};
  progress.forEach((p) => { m[`${p.subtopic_id}:${p.kind}`] = p.pct; });
  const latest: Record<string, SubRow> = {};
  subs.forEach((s) => {
    const k = `${s.subtopic_id}:${s.kind}`;
    if (!latest[k] || latest[k].created_at < s.created_at) latest[k] = s;
  });
  Object.entries(latest).forEach(([k, s]) => { m[k] = s.status === "accepted" ? 100 : s.status === "pending" ? 50 : 0; });
  return m;
}
// Считаем только заполненные разделы (kinds); если их нет, подтема пока не учитывается
export const subtopicPct = (m: Record<string, number>, sid: string, kinds: readonly string[] = KINDS) =>
  kinds.length ? Math.round(kinds.reduce((a, k) => a + (m[`${sid}:${k}`] ?? 0), 0) / kinds.length) : 0;
export const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
