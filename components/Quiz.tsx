"use client";
import { useEffect, useState } from "react";
import { saveProgress } from "@/app/actions";
import type { Question } from "@/lib/types";
import { useT } from "./LangProvider";

const shuffle = (a: number[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

export default function Quiz({ subtopicId, kind, questions, best, preview }: { subtopicId: string; kind: "reading" | "listening"; questions: Question[]; best: number; preview?: boolean }) {
  const t = useT();
  const [order, setOrder] = useState<number[][]>(questions.map((q) => q.options.map((_, j) => j)));
  const [pick, setPick] = useState<(number | null)[]>(questions.map(() => null));
  const [res, setRes] = useState<boolean[] | null>(null);
  const [saved, setSaved] = useState(best);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOrder(questions.map((q) => shuffle(q.options.map((_, j) => j)))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!questions.length) return <p className="text-stone-500">{t("no_questions")}</p>;
  async function check() {
    const ok = questions.map((q, i) => pick[i] === q.correct);
    setRes(ok);
    setBusy(true);
    const next = preview ? null : await saveProgress(subtopicId, kind, (ok.filter(Boolean).length / questions.length) * 100);
    setBusy(false);
    if (typeof next === "number") setSaved(next);
  }
  return (
    <div className="grid gap-5">
      {!preview && <p className="text-sm text-stone-500">{t("best", { pct: saved })}</p>}
      {questions.map((q, i) => (
        <div key={i} className="grid gap-2">
          <p className="font-bold">{i + 1}. {q.q}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {order[i].map((j) => {
              const chosen = pick[i] === j;
              const cls = res ? (j === q.correct ? "border-green-600 bg-green-100" : chosen ? "border-red-600 bg-red-100" : "border-pink-200") : chosen ? "border-pink-600 bg-pink-100" : "border-pink-200";
              return <button key={j} disabled={!!res} onClick={() => setPick(pick.map((x, k) => (k === i ? j : x)))} className={`rounded-xl border-2 bg-white px-4 py-3 text-left font-semibold ${cls}`}>{q.options[j]}</button>;
            })}
          </div>
        </div>))}
      {!res
        ? <button onClick={check} disabled={busy || pick.some((x) => x === null)} className="justify-self-start rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{t("check")}</button>
        : <p className="font-bold text-pink-700">{t("correct_n", { a: res.filter(Boolean).length, b: questions.length })}</p>}
    </div>);
}
