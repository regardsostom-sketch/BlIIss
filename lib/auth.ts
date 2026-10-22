import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getMe() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, me: null };
  const { data } = await sb.from("profiles").select("id,name,role,level,program_id").eq("id", user.id).maybeSingle();
  return { sb, user, me: (data as Profile | null) };
}
export async function requireUser() {
  const r = await getMe();
  if (!r.user) redirect("/login");
  return { sb: r.sb, user: r.user, me: r.me };
}
export async function requireStaff() {
  const r = await getMe();
  if (!r.user) redirect("/login");
  if (!r.me || r.me.role === "student") redirect("/");
  return { sb: r.sb, user: r.user, me: r.me };
}
