import { createClient } from "@supabase/supabase-js";
// Только на сервере! Ключ service_role обходит RLS, в браузер он попадать не должен (имя без NEXT_PUBLIC_).
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
