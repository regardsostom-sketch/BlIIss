"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { STATUS_KEY } from "@/lib/i18n";
import type { AiReport } from "@/lib/ai";
import AiReportView from "./AiReport";
import { useT } from "./LangProvider";

export type LastSub = { status: string; teacher_feedback: string | null } | null;

export default function Writing({ subtopicId, last, draft = "" }: { subtopicId: string; last: LastSub; draft?: string }) {
  const t = useT();
  const [text, setText] = useState(draft); const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState<LastSub>(last); const [err, setErr] = useState("");
  const [ai, setAi] = useState<AiReport | null>(null); const [checking, setChecking] = useState(false);
  async function send() {
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return setErr(t("relogin")); }
    const { data, error } = await sb.from("submissions").insert({ user_id: user.id, subtopic_id: subtopicId, kind: "writing", text }).select("id").single();
    setBusy(false);
    if (error) return setErr(error.message);
    setText(""); setCur({ status: "pending", teacher_feedback: null }); setAi(null);
    // автопроверка: если сервис недоступен, просто ничего не показываем, работа уже у преподавателя
    setChecking(true);
    try {
      const r = await fetch("/api/ai-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id }) });
      if (r.ok) setAi((await r.json()).report ?? null);
    } catch {}
    setChecking(false);
  }
  return (
    <div className="grid gap-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={t("write_ph")} className="w-full rounded-xl border-2 border-pink-200 px-4 py-3" />
      <button disabled={busy || text.trim().length < 3} onClick={send} className="justify-self-start rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{busy ? t("sending") : t("send_teacher")}</button>
      {err && <p className="text-sm text-red-700">{err}</p>}
      {cur && <p className="text-sm font-bold text-pink-700">{t(STATUS_KEY[cur.status])}</p>}
      {cur?.status === "revise" && <p className="text-sm text-stone-600">{t("resubmit_hint")}</p>}
      {checking && <p className="text-sm text-stone-500">{t("ai_checking")}</p>}
      {ai && <AiReportView report={ai} />}
      {cur?.teacher_feedback && <p className="rounded-xl bg-pink-50 p-3"><b>{t("teacher_label")}:</b> {cur.teacher_feedback}</p>}
    </div>);
}
