"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/components/LangProvider";

// Показывается, если страница не смогла отрисоваться (например, нет связи с базой). Шапка и меню остаются на месте.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto grid max-w-xl gap-4 rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{t("err_title")}</h1>
      <p className="text-stone-600">{t("err_text")}</p>
      {error.digest && <p className="text-sm text-stone-500">{t("err_code")}: {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <button onClick={reset} className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("retry")}</button>
        <Link href="/" className="rounded-xl border-2 border-pink-200 bg-white px-5 py-3 font-bold">{t("go_home")}</Link>
      </div>
    </div>);
}
