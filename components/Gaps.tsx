"use client";
import { useState } from "react";
import { saveProgress } from "@/app/actions";
import type { Gap } from "@/lib/types";
import { useT } from "./LangProvider";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, " ").replace(/\s+/g, " ").trim();

export default function Gaps({ subtopicId, gaps, best, preview }: { subtopicId: string; gaps: Gap[]; best: number; preview?: boolean }) {
  const t = useT();
  const [ans, setAns] = useState<string[]>(gaps.map(() => ""));
  const [res, setRes] = useState<boolean[] | null>(null);
  const [saved, setSaved] = useState(best);
  const [busy, setBusy] = useState(false);
  if (!gaps.length) return <p className="text-stone-500">{t("no_exercises")}</p>;
  async function check() {
    const ok = gaps.map((g, i) => norm(ans[i]) === norm(g.answer));
    setRes(ok);
    setBusy(true);
    const next = preview ? null : await saveProgress(subtopicId, "grammar", (ok.filter(Boolean).length / gaps.length) * 100);
    setBusy(false);
    if (typeof next === "number") setSaved(next);
  }
  return (
    <div className="grid gap-4">
      {!preview && <p className="text-sm text-stone-500">{t("best", { pct: saved })}</p>}
      {gaps.map((g, i) => {
        const [a, ...rest] = g.text.split("___");
        return (
          <p key={i} className="text-lg font-semibold leading-10">{a}
            <input value={ans[i]} onChange={(e) => setAns(ans.map((x, j) => (j === i ? e.target.value : x)))} autoCapitalize="off" spellCheck={false}
              className={`mx-1 w-32 rounded-t-lg border-b-4 px-2 text-center font-extrabold ${res ? (res[i] ? "border-green-600 bg-green-100" : "border-red-600 bg-red-100") : "border-pink-600 bg-pink-100"}`} />
            {rest.join("___")}
            {res && !res[i] && <span className="ml-2 text-sm font-normal text-red-700">{t("right_answer", { ans: g.answer })}</span>}
          </p>);
      })}
      <button onClick={check} disabled={busy} className="justify-self-start rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{t("check")}</button>
      {res && <p className="font-bold text-pink-700">{t("correct_n", { a: res.filter(Boolean).length, b: gaps.length })}</p>}
    </div>);
}
