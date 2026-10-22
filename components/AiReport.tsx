"use client";
import { tr, type Lang } from "@/lib/i18n";
import type { AiReport } from "@/lib/ai";
import { useLang } from "./LangProvider";

// Результат автопроверки. Подсказка для студента и для преподавателя; решение принимает преподаватель.
export default function AiReportView({ report, lang }: { report: AiReport; lang?: Lang }) {
  const ctx = useLang();
  const l = lang ?? ctx;
  const t = (k: Parameters<typeof tr>[1], v?: Record<string, string | number>) => tr(l, k, v);
  return (
    <div className="grid gap-2 rounded-xl border-2 border-dashed border-pink-200 bg-white p-3 text-sm">
      <p className="font-bold text-pink-700">{t("ai_title")}</p>
      {report.kind === "speaking" ? (<>
        <p className="text-lg font-extrabold">{t("ai_speak_score", { pct: report.accuracy })}</p>
        <p className="leading-8">{report.words.map((w, i) => (
          <span key={i} className={`mr-1.5 rounded px-1.5 py-0.5 font-bold ${w.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{w.w}</span>))}</p>
        <p className="text-stone-600">{t("ai_words_hint")}</p>
        {report.heard && <p className="text-stone-500">{t("ai_heard")}: {report.heard}</p>}
      </>) : report.issues.length === 0 ? (
        <p className="font-bold text-green-700">{t("ai_writing_ok")}</p>
      ) : (<>
        <p className="font-bold">{t("ai_writing_found", { n: report.issues.length })}</p>
        <ul className="grid gap-1.5">{report.issues.map((x, i) => (
          <li key={i} className="rounded-lg bg-pink-50 px-3 py-2">
            {x.bad && <b className="text-red-700">«{x.bad}»</b>}{x.fix.length > 0 && <> → <b className="text-green-700">{x.fix.join(" / ")}</b></>}
            <span className="block text-stone-600">{x.msg}</span>
          </li>))}</ul>
      </>)}
      <p className="text-xs text-stone-500">{t("ai_disclaimer")}</p>
    </div>);
}
