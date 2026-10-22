import type { Content, Kind } from "./types";
import { toEmbed } from "./video";

// Что вводит преподаватель в конструкторе (до очистки и проверки)
export type DraftGap = { before: string; answer: string; after: string };
export type DraftWord = { en: string; ru: string; kk: string };
export type DraftQuestion = { q: string; options: string[]; correct: number };
export type Draft = {
  video_url?: string; audio_url?: string; text?: string;
  explanation?: string; explanation_kk?: string; task?: string; task_kk?: string; read_text?: string;
  gaps?: DraftGap[]; words?: DraftWord[]; questions?: DraftQuestion[];
};
export type Check = { content: Content; errors: string[]; warnings: string[] };

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

// «She» + «a teacher.» → «She ___ a teacher.» (пробелы и знаки препинания расставляются сами)
export function joinGap(before: string, after: string): string {
  const b = before.trim(), a = after.trim();
  return (b ? b + " " : "") + "___" + (a ? (/^[,.!?;:]/.test(a) ? "" : " ") + a : "");
}
export function splitGap(text: string): { before: string; after: string } {
  const i = text.indexOf("___");
  if (i < 0) return { before: text.trim(), after: "" };
  return { before: text.slice(0, i).trim(), after: text.slice(i + 3).trim() };
}

// Раздел считается заполненным, если в нём есть то, что студент может пройти или сдать
export function isFilled(kind: Kind, c: Content): boolean {
  switch (kind) {
    case "grammar": return (c.gaps?.length ?? 0) > 0;
    case "vocabulary": return (c.words?.length ?? 0) > 0;
    case "reading":
    case "listening": return (c.questions?.length ?? 0) > 0;
    default: return !!c.task;
  }
}

export function toDraft(kind: Kind, c: Content): Draft {
  switch (kind) {
    case "grammar": return { video_url: c.video_url ?? "", explanation: c.explanation ?? "", explanation_kk: c.explanation_kk ?? "",
      gaps: (c.gaps ?? []).map((g) => ({ ...splitGap(g.text), answer: g.answer })) };
    case "vocabulary": return { words: (c.words ?? []).map((w) => ({ en: w.en, ru: w.ru, kk: w.kk ?? "" })) };
    case "reading": return { text: c.text ?? "", questions: (c.questions ?? []).map((q) => ({ ...q, options: [...q.options] })) };
    case "listening": return { video_url: c.video_url ?? "", audio_url: c.audio_url ?? "", text: c.text ?? "",
      questions: (c.questions ?? []).map((q) => ({ ...q, options: [...q.options] })) };
    case "speaking": return { task: c.task ?? "", task_kk: c.task_kk ?? "", read_text: c.read_text ?? "" };
    default: return { task: c.task ?? "", task_kk: c.task_kk ?? "" };
  }
}

export function validate(kind: Kind, raw: unknown): Check {
  const d = obj(raw);
  const errors: string[] = [], warnings: string[] = [];

  const url = (key: "video_url" | "audio_url", label: string): string => {
    const u = s(d[key]);
    if (!u) return "";
    if (!/^https:\/\//i.test(u)) errors.push(`${label}: ссылка должна начинаться с https://`);
    else if (key === "video_url" && toEmbed(u)?.type === "link")
      warnings.push("Ссылка на видео не похожа на YouTube, Vimeo или файл .mp4: студент увидит обычную ссылку.");
    return u;
  };
  const gaps = () => arr(d.gaps).flatMap((g, i) => {
    const r = obj(g), before = s(r.before), answer = s(r.answer), after = s(r.after);
    if (!before && !answer && !after) return [];
    if (!answer) { errors.push(`Упражнение ${i + 1}: впишите слово, которое нужно угадать`); return []; }
    if (!before && !after) { errors.push(`Упражнение ${i + 1}: добавьте текст предложения до или после пропуска`); return []; }
    return [{ text: joinGap(before, after), answer }];
  });
  const words = () => arr(d.words).flatMap((w, i) => {
    const r = obj(w), en = s(r.en), ru = s(r.ru), kk = s(r.kk);
    if (!en && !ru && !kk) return [];
    if (!en) { errors.push(`Слово ${i + 1}: впишите английское слово`); return []; }
    if (!ru) { errors.push(`Слово ${i + 1}: впишите перевод на русский`); return []; }
    return [kk ? { en, ru, kk } : { en, ru }];
  });
  const questions = () => arr(d.questions).flatMap((x, i) => {
    const r = obj(x), q = s(r.q), opts = arr(r.options).map(s), correct = typeof r.correct === "number" ? r.correct : -1;
    if (!q && opts.every((o) => !o)) return [];
    if (!q) { errors.push(`Вопрос ${i + 1}: впишите текст вопроса`); return []; }
    const kept = opts.filter(Boolean);
    if (kept.length < 2) { errors.push(`Вопрос ${i + 1}: нужно минимум 2 варианта ответа`); return []; }
    if (!Number.isInteger(correct) || correct < 0 || correct >= opts.length || !opts[correct]) {
      errors.push(`Вопрос ${i + 1}: отметьте правильный ответ`); return [];
    }
    return [{ q, options: kept, correct: opts.slice(0, correct).filter(Boolean).length }];
  });

  let content: Content;
  switch (kind) {
    case "grammar": content = { video_url: url("video_url", "Видео"), explanation: s(d.explanation), explanation_kk: s(d.explanation_kk), gaps: gaps() }; break;
    case "vocabulary": content = { words: words() }; break;
    case "reading": content = { text: s(d.text), questions: questions() }; break;
    case "listening": content = { video_url: url("video_url", "Видео"), audio_url: url("audio_url", "Аудио"), text: s(d.text), questions: questions() }; break;
    case "speaking": {
      const read_text = s(d.read_text);
      if (read_text.length > 300) errors.push("Фраза для чтения: не длиннее 300 символов (одно-два коротких предложения).");
      if (/[\u0400-\u04FF\u04E8\u04E9\u0492\u0493]/.test(read_text)) errors.push("Фраза для чтения должна быть по-английски: автопроверка произношения работает только с английским.");
      content = { task: s(d.task), task_kk: s(d.task_kk), ...(read_text ? { read_text } : {}) };
      break;
    }
    default: content = { task: s(d.task), task_kk: s(d.task_kk) };
  }
  if (!isFilled(kind, content)) {
    const what = { grammar: "Нет упражнений", vocabulary: "Нет слов", reading: "Нет вопросов", listening: "Нет вопросов", writing: "Нет задания", speaking: "Нет задания" }[kind];
    warnings.push(`${what}: пока раздел не будет учитываться в прогрессе студента.`);
  }
  if (kind === "speaking" && content.task && !content.read_text) warnings.push("Фраза для чтения не задана: запись проверит только преподаватель (автопроверка произношения не сработает).");
  if (kind === "reading" && !content.text) warnings.push("Нет текста для чтения.");
  if (kind === "listening" && !content.video_url && !content.audio_url && !content.text) warnings.push("Нет видео, аудио и текста: студенту нечего слушать.");
  return { content, errors, warnings };
}
