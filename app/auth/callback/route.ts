import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// Сюда ведут ссылки из писем Supabase (подтверждение email и восстановление пароля).
// Обмениваем одноразовый код на сессию и отправляем студента дальше (next).
// Поддерживаются оба вида ссылок: ?code=… (по умолчанию) и ?token_hash=…&type=… (если изменён шаблон письма).
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  // За обратным прокси (Caddy, Nginx) внутренний адрес может отличаться от публичного: тогда задайте NEXT_PUBLIC_SITE_URL
  const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const next = safeNext(p.get("next"));
  const code = p.get("code");
  const tokenHash = p.get("token_hash");
  const type = p.get("type") as EmailOtpType | null;

  const sb = await supabaseServer();
  let ok = false;
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await sb.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  // Восстановление пароля с неудачной ссылкой ведёт на запрос новой, остальное на вход
  const fail = next === "/reset" ? "/reset" : "/login?e=link";
  return NextResponse.redirect(new URL(ok ? next : fail, base));
}
