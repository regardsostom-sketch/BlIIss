"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/components/LangProvider";

// Шаг 2 восстановления пароля. Сюда студент попадает после /auth/callback, уже со входом по ссылке из письма.
export default function Reset() {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<"load" | "ok" | "none">("load");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabaseBrowser().auth.getUser().then(({ data }) => setState(data.user ? "ok" : "none"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw !== pw2) return setErr(t("pw_mismatch"));
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    setTimeout(() => { router.push("/"); router.refresh(); }, 1200);
  }

  const input = "w-full rounded-xl border-2 border-pink-200 bg-white px-4 py-3";
  if (state === "load") return null;
  if (state === "none") return (
    <div className="mx-auto grid max-w-sm gap-3 rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{t("reset_title")}</h1>
      <p role="alert" className="text-pink-700">{t("link_bad")}</p>
      <Link href="/forgot" className="justify-self-start rounded-xl bg-pink-600 px-4 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("request_new")}</Link>
    </div>);
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-sm gap-3 rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{t("reset_title")}</h1>
      {done
        ? <p role="status" className="rounded-xl bg-pink-50 p-3 font-bold text-pink-700">{t("password_saved")}</p>
        : <>
            <input className={input} type="password" placeholder={t("new_password")} minLength={6} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <input className={input} type="password" placeholder={t("repeat_password")} minLength={6} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <button disabled={busy} className="rounded-xl bg-pink-600 px-4 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{t("save_password")}</button>
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          </>}
    </form>);
}
