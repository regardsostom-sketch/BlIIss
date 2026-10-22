"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { STATUS_KEY } from "@/lib/i18n";
import type { AiReport } from "@/lib/ai";
import AiReportView from "./AiReport";
import { useT } from "./LangProvider";
import type { LastSub } from "./Writing";

const MAX_SEC = 180;
// Chrome/Android: webm, Firefox: ogg, Safari/iPhone: mp4. Выбираем то, что умеет браузер.
const pickType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
};
const extFor = (type: string) => (type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Speaking({ subtopicId, last, readText }: { subtopicId: string; last: LastSub; readText?: string }) {
  const t = useT();
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cur, setCur] = useState<LastSub>(last);
  const [ai, setAi] = useState<AiReport | null>(null);
  const [checking, setChecking] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  // при уходе со страницы выключаем микрофон
  useEffect(() => () => { clearTimer(); if (mr.current?.state === "recording") mr.current.stop(); }, []);

  async function start() {
    setErr("");
    if (url) URL.revokeObjectURL(url);
    setBlob(null); setUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickType();
      const r = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const b = new Blob(chunks.current, { type: r.mimeType || mimeType || "audio/webm" });
        if (b.size) { setBlob(b); setUrl(URL.createObjectURL(b)); }
      };
      r.start(); mr.current = r; setRec(true); setSec(0);
      const t0 = Date.now();
      timer.current = setInterval(() => {
        const s = Math.min(MAX_SEC, Math.floor((Date.now() - t0) / 1000));
        setSec(s);
        if (s >= MAX_SEC) stop();
      }, 500);
    } catch { setErr(t("mic_denied")); }
  }
  function stop() { clearTimer(); if (mr.current?.state === "recording") mr.current.stop(); setRec(false); }
  async function send() {
    if (!blob) return;
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return setErr(t("relogin")); }
    const type = blob.type.split(";")[0] || "audio/webm";
    const path = `${user.id}/${subtopicId}-${Date.now()}.${extFor(type)}`;
    const up = await sb.storage.from("speaking").upload(path, blob, { contentType: type });
    if (up.error) { setBusy(false); return setErr(up.error.message); }
    const { data, error } = await sb.from("submissions").insert({ user_id: user.id, subtopic_id: subtopicId, kind: "speaking", audio_path: path }).select("id").single();
    setBusy(false);
    if (error) return setErr(error.message);
    URL.revokeObjectURL(url); setBlob(null); setUrl(""); setCur({ status: "pending", teacher_feedback: null }); setAi(null);
    // оценка произношения есть только если преподаватель задал фразу для чтения; при ошибке сервиса работа всё равно у преподавателя
    if (readText) {
      setChecking(true);
      try {
        const r = await fetch("/api/ai-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id }) });
        if (r.ok) setAi((await r.json()).report ?? null);
      } catch {}
      setChecking(false);
    }
  }
  return (
    <div className="grid gap-3">
      {readText && <p className="rounded-xl border-2 border-pink-200 bg-white p-4 text-lg"><b className="text-pink-700">{t("read_aloud")}:</b> {readText}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!rec
          ? <button disabled={busy} onClick={start} className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">● {blob ? t("rec_again") : t("rec_start")}</button>
          : <button onClick={stop} className="rounded-xl bg-stone-800 px-5 py-3 font-bold text-white">■ {t("rec_stop")}</button>}
        {rec && <span className="font-mono text-lg font-bold text-pink-700">{mmss(sec)} / {mmss(MAX_SEC)}</span>}
        {!rec && !blob && <span className="text-sm text-stone-500">{t("rec_limit")}</span>}
      </div>
      {url && <audio controls src={url} className="w-full" />}
      {blob && !rec && <button disabled={busy} onClick={send} className="justify-self-start rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? t("sending") : t("send_teacher")}</button>}
      {err && <p className="text-sm text-red-700">{err}</p>}
      {cur && <p className="text-sm font-bold text-pink-700">{t(STATUS_KEY[cur.status])}</p>}
      {cur?.status === "revise" && <p className="text-sm text-stone-600">{t("resubmit_hint")}</p>}
      {checking && <p className="text-sm text-stone-500">{t("ai_checking")}</p>}
      {ai && <AiReportView report={ai} />}
      {cur?.teacher_feedback && <p className="rounded-xl bg-pink-50 p-3"><b>{t("teacher_label")}:</b> {cur.teacher_feedback}</p>}
    </div>);
}
