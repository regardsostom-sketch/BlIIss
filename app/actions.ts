"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function setLang(lang: string) {
  (await cookies()).set("lang", lang === "kk" ? "kk" : "ru", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function signOut() { await (await supabaseServer()).auth.signOut(); redirect("/"); }

// Сохраняет лучший результат студента по разделу подтемы
export async function saveProgress(subtopicId: string, kind: string, pct: number): Promise<number | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const { data: old } = await sb.from("progress").select("pct").eq("user_id", user.id).eq("subtopic_id", subtopicId).eq("kind", kind).maybeSingle();
  const next = Math.max(old?.pct ?? 0, p);
  const { error } = await sb.from("progress").upsert({ user_id: user.id, subtopic_id: subtopicId, kind, pct: next, updated_at: new Date().toISOString() });
  return error ? null : next;
}
