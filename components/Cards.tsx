"use client";
import { useState } from "react";
import { saveProgress } from "@/app/actions";
import { speak } from "@/lib/speech";
import type { Word } from "@/lib/types";
import { useLang, useT } from "./LangProvider";

export default function Cards({ subtopicId, words, best, preview }: { subtopicId: string; words: Word[]; best: number; preview?: boolean }) {
  const t = useT();
  const lang = useLang();
  const tl = (x: Word) => (lang === "kk" && x.kk ? x.kk : x.ru);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [known, setKnown] = useState(0);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(best);
  if (!words.length) return <p className="text-stone-500">{t("no_words")}</p>;
  async function answer(k: boolean) {
    const kn = known + (k ? 1 : 0);
    setKnown(kn); setShow(false);
    if (i + 1 >= words.length) {
      setDone(true);
      const next = preview ? null : await saveProgress(subtopicId, "vocabulary", (kn / words.length) * 100);
      if (typeof next === "number") setSaved(next);
    } else setI(i + 1);
  }
  const again = () => { setI(0); setKnown(0); setDone(false); setShow(false); };
  const w = words[i];
  return (
    <div className="grid gap-5">
      {!preview && <p className="text-sm text-stone-500">{t("best", { pct: saved })}</p>}
      {done ? (
        <div className="grid gap-3 rounded-2xl bg-pink-50 p-6 text-center">
          <p className="text-2xl font-extrabold">{t("know_n", { a: known, b: words.length })}</p>
          <button onClick={again} className="justify-self-center rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("again")}</button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-2xl bg-pink-50 p-6 text-center">
          <p className="text-sm text-stone-500">{i + 1} / {words.length}</p>
          <p className="text-3xl font-extrabold">{w.en}</p>
          <button onClick={() => speak(w.en)} className="justify-self-center text-sm font-bold text-pink-700">▶ {t("listen")}</button>
          <p className="min-h-8 text-xl text-pink-800">{show ? tl(w) : ""}</p>
          {!show ? (
            <button onClick={() => setShow(true)} className="justify-self-center rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("show_translation")}</button>
          ) : (
            <div className="flex justify-center gap-3">
              <button onClick={() => answer(false)} className="rounded-xl border-2 border-pink-300 bg-white px-5 py-3 font-bold">{t("dont_know")}</button>
              <button onClick={() => answer(true)} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white">{t("know")}</button>
            </div>)}
        </div>)}
      <ul className="grid gap-1 sm:grid-cols-2">
        {words.map((x, j) => <li key={j}><b>{x.en}</b> <span className="text-stone-500">{tl(x)}</span></li>)}
      </ul>
    </div>);
}
