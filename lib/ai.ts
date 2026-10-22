// Автопроверка работ студентов. Работает только на сервере.
//  • говорение: ai-pronunciation-trainer (open source, MIT), свой маленький Python-сервис, адрес в PRONUNCIATION_API_URL;
//  • письмо:    LanguageTool (open source), публичный API или свой сервер, адрес в LANGUAGETOOL_URL.
// Если сервис не отвечает, функции возвращают null: работа всё равно уходит преподавателю.

export type AiWord = { w: string; ok: boolean };
export type AiIssue = { msg: string; bad: string; fix: string[] };
export type AiReport =
  | { kind: "speaking"; accuracy: number; reference: string; heard: string; words: AiWord[] }
  | { kind: "writing"; words: number; issues: AiIssue[] };

const base = (v: string | undefined) => (v ? v.trim().replace(/\/+$/, "") : "");
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
const split = (v: unknown) => String(v ?? "").trim().split(/\s+/).filter(Boolean);

// ai-pronunciation-trainer: POST /GetAccuracyFromRecordedAudio {title, base64Audio, language}.
// Сервис отрезает первые 22 символа base64Audio (префикс data-URL), поэтому шлём ровно такой префикс;
// формат файла он определяет сам (через ffmpeg), поэтому webm/mp4/ogg из браузера подходят.
export async function checkPronunciation(audio: Buffer, reference: string): Promise<AiReport | null> {
  const url = base(process.env.PRONUNCIATION_API_URL);
  if (!url || !reference.trim()) return null;
  try {
    const res = await fetch(`${url}/GetAccuracyFromRecordedAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: reference, base64Audio: "data:audio/ogg;base64," + audio.toString("base64"), language: "en" }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    let j: unknown = JSON.parse(await res.text());
    if (typeof j === "string") j = JSON.parse(j); // сервис может вернуть JSON внутри строки
    const r = j as Record<string, unknown>;
    const accuracy = Number(r.pronunciation_accuracy);
    if (!Number.isFinite(accuracy)) return null;
    const ref = split(r.real_transcripts ?? r.real_transcript ?? reference);
    const heard = split(r.matched_transcripts);
    const letters = split(r.is_letter_correct_all_words); // по слову: строка из 1 (верно) и 0 (ошибка)
    const words: AiWord[] = ref.map((w, i) => ({
      w,
      ok: letters.length === ref.length ? !letters[i].includes("0") : norm(heard[i] ?? "") === norm(w),
    }));
    return { kind: "speaking", accuracy: Math.max(0, Math.min(100, Math.round(accuracy))), reference, heard: heard.join(" "), words };
  } catch { return null; }
}

// LanguageTool: POST /v2/check (грамматика, орфография, пунктуация). Язык заданий английский.
export async function checkWriting(text: string): Promise<AiReport | null> {
  const url = base(process.env.LANGUAGETOOL_URL) || "https://api.languagetool.org";
  const t = text.slice(0, 5000);
  if (t.trim().length < 3) return null;
  try {
    const res = await fetch(`${url}/v2/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: t, language: "en-US" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { matches?: { message: string; offset: number; length: number; replacements?: { value: string }[] }[] };
    const issues: AiIssue[] = (j.matches ?? []).slice(0, 15).map((m) => ({
      msg: m.message,
      bad: t.slice(m.offset, m.offset + m.length),
      fix: (m.replacements ?? []).slice(0, 3).map((x) => x.value),
    }));
    return { kind: "writing", words: split(t).length, issues };
  } catch { return null; }
}
