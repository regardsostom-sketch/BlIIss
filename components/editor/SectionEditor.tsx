"use client";
import { useMemo, useRef, useState } from "react";
import { saveSectionContent } from "@/app/admin/actions";
import Cards from "@/components/Cards";
import Gaps from "@/components/Gaps";
import Listen from "@/components/Listen";
import Quiz from "@/components/Quiz";
import Video from "@/components/Video";
import { ACCEPT, checkMedia, mediaPath, mediaType, type MediaKind } from "@/lib/media";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isFilled, toDraft, validate, type Draft, type DraftGap, type DraftQuestion, type DraftWord } from "@/lib/validate";
import { KIND_RU, type Content, type Kind } from "@/lib/types";

const inp = "w-full min-w-0 rounded-xl border-2 border-pink-200 bg-white px-3 py-2";
const mini = "rounded-lg border-2 border-pink-200 bg-white px-3 py-1 text-sm font-bold";
const lbl = "grid gap-1 text-sm font-bold text-stone-600";
const hint = "text-sm font-normal text-stone-500";
type Msg = { ok: boolean; errors: string[]; warnings: string[] };

const emptyGap = (): DraftGap => ({ before: "", answer: "", after: "" });
const emptyWord = (): DraftWord => ({ en: "", ru: "", kk: "" });
const emptyQ = (): DraftQuestion => ({ q: "", options: ["", "", ""], correct: -1 });

function prep(kind: Kind, d: Draft): Draft {
  if (kind === "grammar" && !d.gaps?.length) d.gaps = [emptyGap()];
  if (kind === "vocabulary" && !d.words?.length) d.words = [emptyWord()];
  if ((kind === "reading" || kind === "listening") && !d.questions?.length) d.questions = [emptyQ()];
  return d;
}

// Ссылка на файл: можно вставить ссылку или загрузить файл с компьютера на сайт
function MediaField({ label, kind, value, onChange, subtopicId, help }: { label: string; kind: MediaKind; value: string; onChange: (v: string) => void; subtopicId: string; help: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const uploaded = value.includes("/storage/v1/object/public/media/");
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const bad = checkMedia(kind, f.name, f.size);
    if (bad) return setErr(bad);
    setBusy(true); setErr("");
    try {
      const sb = supabaseBrowser();
      const path = mediaPath(subtopicId, f.name);
      const { error } = await sb.storage.from("media").upload(path, f, { contentType: mediaType(kind, f.name), cacheControl: "31536000" });
      if (error) setErr(`Не удалось загрузить: ${error.message}`);
      else onChange(sb.storage.from("media").getPublicUrl(path).data.publicUrl);
    } catch {
      setErr("Не удалось загрузить. Проверьте соединение и попробуйте ещё раз.");
    } finally { setBusy(false); }
  }
  return (
    <div className={lbl}>
      <span>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inp} flex-1`} placeholder={kind === "video" ? "Ссылка YouTube, Vimeo или .mp4" : "Ссылка на аудиофайл"} value={value} onChange={(e) => onChange(e.target.value)} />
        <input ref={ref} type="file" accept={ACCEPT[kind]} onChange={pick} className="hidden" aria-label={`Выбрать файл: ${label}`} />
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={mini}>{busy ? "Загружаем…" : "⬆ Загрузить файл"}</button>
        {value && <button type="button" className={mini} onClick={() => onChange("")}>Убрать</button>}
      </div>
      {busy && <span className={hint}>Идёт загрузка, не закрывайте страницу. Большие файлы могут грузиться несколько минут.</span>}
      {err && <span className="rounded-lg bg-red-50 p-2 font-normal text-red-800">{err}</span>}
      {uploaded && !busy && !err && <span className="font-normal text-green-800">✓ Файл загружен на сайт. Не забудьте нажать «Сохранить раздел».</span>}
      {!uploaded && !err && !busy && <span className={hint}>{help}</span>}
    </div>);
}

function QuestionsEditor({ prefix, value, onChange }: { prefix: string; value: DraftQuestion[]; onChange: (v: DraftQuestion[]) => void }) {
  const upd = (i: number, patch: Partial<DraftQuestion>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const removeOpt = (i: number, j: number) => {
    const q = value[i];
    upd(i, { options: q.options.filter((_, k) => k !== j), correct: q.correct === j ? -1 : q.correct > j ? q.correct - 1 : q.correct });
  };
  return (
    <div className="grid gap-3">
      {value.map((q, i) => (
        <div key={i} className="grid gap-2 rounded-xl border-2 border-pink-100 p-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-pink-700">{i + 1}.</span>
            <input className={inp} placeholder="Вопрос, например: Where is Tom from?" value={q.q} onChange={(e) => upd(i, { q: e.target.value })} />
            <button type="button" className={`${mini} text-red-700`} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Удалить вопрос">✕</button>
          </div>
          <p className={hint}>Отметьте кружком правильный ответ. Студенту варианты покажутся вперемешку.</p>
          {q.options.map((o, j) => (
            <div key={j} className="flex items-center gap-2">
              <input type="radio" name={`${prefix}-q${i}`} checked={q.correct === j} onChange={() => upd(i, { correct: j })} aria-label="Правильный ответ" className="h-5 w-5 shrink-0 accent-pink-600" />
              <input className={inp} placeholder={`Вариант ${j + 1}`} value={o} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
              {q.options.length > 2 && <button type="button" className={mini} onClick={() => removeOpt(i, j)} aria-label="Убрать вариант">−</button>}
            </div>))}
          {q.options.length < 6 && <button type="button" className={`${mini} justify-self-start`} onClick={() => upd(i, { options: [...q.options, ""] })}>+ вариант</button>}
        </div>))}
      <button type="button" className={`${mini} justify-self-start`} onClick={() => onChange([...value, emptyQ()])}>+ Добавить вопрос</button>
    </div>);
}

function Preview({ kind, c }: { kind: Kind; c: Content }) {
  const sig = JSON.stringify(c);
  const note = <p className={hint}>Так раздел выглядит у студента. Ответы в предпросмотре никуда не сохраняются.</p>;
  switch (kind) {
    case "grammar": return (<div className="grid gap-3">{note}<Video url={c.video_url} />
      {c.explanation && <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-3">{c.explanation}</p>}
      {c.explanation_kk && <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-3">ҚАЗ: {c.explanation_kk}</p>}
      <Gaps key={sig} subtopicId="preview" gaps={c.gaps ?? []} best={0} preview /></div>);
    case "vocabulary": return <div className="grid gap-3">{note}<Cards key={sig} subtopicId="preview" words={c.words ?? []} best={0} preview /></div>;
    case "reading": return (<div className="grid gap-3">{note}
      {c.text && <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-3 text-lg">{c.text}</p>}
      <Quiz key={sig} subtopicId="preview" kind="reading" questions={c.questions ?? []} best={0} preview /></div>);
    case "listening": return (<div className="grid gap-3">{note}
      {c.video_url ? <Video url={c.video_url} /> : <Listen audioUrl={c.audio_url || undefined} text={c.text} />}
      <Quiz key={sig} subtopicId="preview" kind="listening" questions={c.questions ?? []} best={0} preview /></div>);
    default: return (<div className="grid gap-3">{note}
      <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-3">{c.task || "—"}</p>
      {c.task_kk && <p className="whitespace-pre-wrap rounded-xl bg-pink-50 p-3">ҚАЗ: {c.task_kk}</p>}
      {kind === "speaking" && c.read_text && <p className="rounded-xl bg-white p-3 font-bold">Прочитать вслух: {c.read_text}</p>}
      <p className={hint}>{kind === "writing" ? "Ниже студент увидит поле для текста и кнопку отправки." : "Ниже студент увидит кнопку записи голоса и отправки."}</p></div>);
  }
}

export default function SectionEditor({ subtopicId, kind, initial }: { subtopicId: string; kind: Kind; initial: Content }) {
  const [d, setD] = useState<Draft>(() => prep(kind, toDraft(kind, initial)));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [showPrev, setShowPrev] = useState(false);
  const chk = useMemo(() => validate(kind, d), [kind, d]);
  const filled = isFilled(kind, chk.content);
  const set = (patch: Partial<Draft>) => { setD((p) => ({ ...p, ...patch })); setDirty(true); setMsg(null); };

  async function save() {
    setBusy(true);
    try {
      const r = await saveSectionContent(subtopicId, kind, d);
      setMsg(r);
      if (r.ok) setDirty(false);
    } catch {
      setMsg({ ok: false, errors: ["Не удалось сохранить. Проверьте соединение и попробуйте ещё раз."], warnings: [] });
    } finally { setBusy(false); }
  }

  const gaps = d.gaps ?? [], words = d.words ?? [];
  const setGap = (i: number, patch: Partial<DraftGap>) => set({ gaps: gaps.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const setWord = (i: number, patch: Partial<DraftWord>) => set({ words: words.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const text = (key: keyof Draft, label: string, rows: number, ph = "") => (
    <label className={lbl}>{label}<textarea rows={rows} className={inp} placeholder={ph} value={(d[key] as string) ?? ""} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} /></label>);
  const line = (key: keyof Draft, label: string, ph = "", help = "") => (
    <label className={lbl}>{label}<input className={inp} placeholder={ph} value={(d[key] as string) ?? ""} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} />{help && <span className={hint}>{help}</span>}</label>);

  return (
    <details className="rounded-2xl border border-pink-200 bg-white p-5">
      <summary className="flex cursor-pointer flex-wrap items-center gap-3">
        <span className="text-xl font-bold">{KIND_RU[kind]}</span>
        <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${filled ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600"}`}>{filled ? "заполнено" : "пусто"}</span>
        {dirty && <span className="rounded-full bg-amber-100 px-3 py-0.5 text-sm font-bold text-amber-800">не сохранено</span>}
      </summary>
      <div className="mt-4 grid gap-4">
        {kind === "grammar" && <>
          <MediaField label="Видео-урок (необязательно)" kind="video" subtopicId={subtopicId} value={d.video_url ?? ""} onChange={(video_url) => set({ video_url })} help="Вставьте ссылку или загрузите файл .mp4, .webm до 50 МБ" />
          {text("explanation", "Объяснение правила", 4)}
          {text("explanation_kk", "Объяснение на казахском (необязательно)", 3)}
          <div className="grid gap-2">
            <p className={lbl.replace("grid gap-1 ", "")}>Упражнения: впишите предложение и слово, которое студент должен угадать</p>
            {gaps.map((g, i) => (
              <div key={i} className="grid gap-2 rounded-xl border-2 border-pink-100 p-3 sm:grid-cols-[1fr_9rem_1fr_auto]">
                <input className={inp} placeholder="Текст до пропуска: She" value={g.before} onChange={(e) => setGap(i, { before: e.target.value })} />
                <input className={`${inp} border-pink-500 bg-pink-50 font-bold`} placeholder="Слово: is" value={g.answer} onChange={(e) => setGap(i, { answer: e.target.value })} />
                <input className={inp} placeholder="Текст после: a teacher." value={g.after} onChange={(e) => setGap(i, { after: e.target.value })} />
                <button type="button" className={`${mini} text-red-700`} onClick={() => set({ gaps: gaps.filter((_, j) => j !== i) })} aria-label="Удалить упражнение">✕</button>
              </div>))}
            <button type="button" className={`${mini} justify-self-start`} onClick={() => set({ gaps: [...gaps, emptyGap()] })}>+ Добавить упражнение</button>
          </div></>}

        {kind === "vocabulary" && (
          <div className="grid gap-2">
            <p className={hint}>Английское слово, перевод на русский и (по желанию) на казахский.</p>
            {words.map((w, i) => (
              <div key={i} className="grid gap-2 rounded-xl border-2 border-pink-100 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input className={inp} placeholder="hello" value={w.en} onChange={(e) => setWord(i, { en: e.target.value })} />
                <input className={inp} placeholder="привет" value={w.ru} onChange={(e) => setWord(i, { ru: e.target.value })} />
                <input className={inp} placeholder="сәлем (необязательно)" value={w.kk} onChange={(e) => setWord(i, { kk: e.target.value })} />
                <button type="button" className={`${mini} text-red-700`} onClick={() => set({ words: words.filter((_, j) => j !== i) })} aria-label="Удалить слово">✕</button>
              </div>))}
            <button type="button" className={`${mini} justify-self-start`} onClick={() => set({ words: [...words, emptyWord()] })}>+ Добавить слово</button>
          </div>)}

        {kind === "reading" && <>
          {text("text", "Текст для чтения", 6)}
          <QuestionsEditor prefix={kind} value={d.questions ?? []} onChange={(questions) => set({ questions })} /></>}

        {kind === "listening" && <>
          <MediaField label="Видео (необязательно)" kind="video" subtopicId={subtopicId} value={d.video_url ?? ""} onChange={(video_url) => set({ video_url })} help="Если есть видео, оно показывается вместо аудио. Файл .mp4, .webm до 50 МБ или ссылка." />
          <MediaField label="Аудио (необязательно)" kind="audio" subtopicId={subtopicId} value={d.audio_url ?? ""} onChange={(audio_url) => set({ audio_url })} help="Файл .mp3, .m4a, .wav до 50 МБ или ссылка. Без видео и аудио текст ниже озвучит браузер студента." />
          {text("text", "Текст записи (расшифровка)", 4)}
          <QuestionsEditor prefix={kind} value={d.questions ?? []} onChange={(questions) => set({ questions })} /></>}

        {(kind === "writing" || kind === "speaking") && <>
          {text("task", kind === "writing" ? "Задание для письма" : "Задание для говорения (студент запишет голос)", 4)}
          {text("task_kk", "Задание на казахском (необязательно)", 3)}
          {kind === "speaking" && line("read_text", "Фраза для автопроверки произношения (по-английски, необязательно)", "I would like a cup of coffee, please.",
            "Студент прочитает её вслух, и программа оценит произношение по словам. Одно-два коротких предложения. Если оставить пустым, запись проверит только преподаватель.")}</>}

        {dirty && chk.errors.length > 0 && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <b>Исправьте, чтобы сохранить:</b><ul className="mt-1 list-disc pl-5">{chk.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>)}
        {chk.warnings.length > 0 && (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <ul className="list-disc pl-5">{chk.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>)}
        {msg && (msg.ok
          ? <p className="rounded-xl bg-green-50 p-3 font-bold text-green-800">Сохранено</p>
          : <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-800"><ul className="list-disc pl-5">{msg.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>)}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy || chk.errors.length > 0 || !dirty}
            className="rounded-xl bg-pink-600 px-5 py-2 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{busy ? "Сохраняем…" : "Сохранить раздел"}</button>
          {!dirty && !msg && <span className={hint}>Изменений нет</span>}
        </div>

        <details onToggle={(e) => setShowPrev((e.currentTarget as HTMLDetailsElement).open)} className="rounded-xl border-2 border-dashed border-pink-300 p-3">
          <summary className="cursor-pointer font-bold text-pink-700">👁 Как увидит студент</summary>
          <div className="mt-3">{showPrev && <Preview kind={kind} c={chk.content} />}</div>
        </details>
      </div>
    </details>);
}
