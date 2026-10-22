"use client";
import { speak } from "@/lib/speech";
import { useT } from "./LangProvider";

export default function Listen({ audioUrl, text }: { audioUrl?: string; text?: string }) {
  const t = useT();
  return (
    <div className="grid gap-2 rounded-2xl bg-pink-50 p-4">
      {audioUrl ? <audio controls src={audioUrl} className="w-full" />
        : text ? (
          <div className="flex gap-2">
            <button onClick={() => speak(text)} className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">▶ {t("play")}</button>
            <button onClick={() => speak(text, 0.7)} className="rounded-xl border-2 border-pink-300 bg-white px-4 py-2 font-bold">{t("slow")}</button>
          </div>
        ) : <p className="text-stone-500">{t("no_audio")}</p>}
      {text && <details><summary className="cursor-pointer font-bold text-pink-700">{t("show_text")}</summary><p className="mt-2 whitespace-pre-wrap">{text}</p></details>}
    </div>);
}
