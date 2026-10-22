"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LEVELS } from "@/lib/types";
import { useT } from "@/components/LangProvider";

function LoginForm() {
  const t = useT();
  const params = useSearchParams();
  const [mode, setMode] = useState<"in" | "up">(params.get("mode") === "up" ? "up" : "in");
  const [f, setF] = useState({ name: "", email: "", password: "", level: "A1" });
  const [msg, setMsg] = useState(params.get("e") === "link" ? t("link_bad") : "");
  const [canResend, setCanResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // Куда ведёт ссылка из письма подтверждения (страница /auth/callback обменивает её на вход)
  const callback = () => `${location.origin}/auth/callback`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setCanResend(false); setBusy(true);
    const sb = supabaseBrowser();
    const { data, error } = mode === "up"
      ? await sb.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { name: f.name, level: f.level }, emailRedirectTo: callback() } })
      : await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    setBusy(false);
    if (error) {
      if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) { setCanResend(true); return setMsg(t("email_unconfirmed")); }
      if (/invalid login credentials/i.test(error.message)) return setMsg(t("bad_creds"));
      if (error.status === 429) return setMsg(t("too_many"));
      return setMsg(error.message);
    }
    if (mode === "up" && !data.session) { setCanResend(true); return setMsg(t("check_mail")); }
    router.push("/"); router.refresh();
  }

  async function resend() {
    setCanResend(false);
    const { error } = await supabaseBrowser().auth.resend({ type: "signup", email: f.email.trim(), options: { emailRedirectTo: callback() } });
    if (error) { setCanResend(true); return setMsg(error.status === 429 ? t("too_many") : error.message); }
    setMsg(t("resent"));
  }

  const input = "w-full rounded-xl border-2 border-pink-200 bg-white px-4 py-3";
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-sm gap-3 rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{mode === "in" ? t("login_title") : t("reg_title")}</h1>
      {mode === "up" && <>
        <input className={input} placeholder={t("f_name")} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="grid gap-1 text-sm font-bold text-stone-600">{t("f_level")}
          <select className={input} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <span className="font-normal text-stone-500">{t("level_hint")}</span>
        </label></>}
      <input className={input} type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className={input} type="password" placeholder={t("f_password")} minLength={6} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button disabled={busy} className="rounded-xl bg-pink-600 px-4 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800 disabled:opacity-50">{mode === "in" ? t("login") : t("create_account")}</button>
      {msg && <p role="status" className="text-sm text-pink-700">{msg}</p>}
      {canResend && <button type="button" onClick={resend} className="justify-self-start text-sm font-bold text-pink-700 underline">{t("resend_confirm")}</button>}
      {mode === "in" && <Link href="/forgot" className="text-sm font-bold text-pink-700">{t("forgot_link")}</Link>}
      <button type="button" className="text-sm font-bold text-stone-500" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); setCanResend(false); }}>
        {mode === "in" ? t("no_account") : t("have_account")}</button>
    </form>);
}
export default function Login() { return <Suspense><LoginForm /></Suspense>; }
