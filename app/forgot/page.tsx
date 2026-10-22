"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/components/LangProvider";

// Шаг 1 восстановления пароля: студент вводит email, ему приходит письмо со ссылкой на /auth/callback → /reset
export default function Forgot() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/reset` });
    setBusy(false);
    if (error) return setErr(error.status === 429 ? t("too_many") : error.message);
    setSent(true); // одинаковый ответ, есть такой email в базе или нет
  }

  const input = "w-full rounded-xl border-2 border-pink-200 bg-white px-4 py-3";
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-sm gap-3 rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{t("forgot_title")}</h1>
      {sent
        ? <p role="status" className="rounded-xl bg-pink-50 p-3">{t("reset_sent")}</p>
        : <>
            <p className="text-stone-600">{t("forgot_hint")}</p>
            <input className={input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button disabled={busy} className="rounded-xl bg-pink-600 px-4 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{t("send_link")}</button>
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          </>}
      <Link href="/login" className="text-sm font-bold text-stone-500">{t("back_login")}</Link>
    </form>);
}
