import { NextResponse } from "next/server";
import { checkPronunciation, checkWriting, type AiReport } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Content } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (report: AiReport | null, status = 200) => NextResponse.json({ report }, { status });

// Студент уже отправил работу; здесь мы по её id запускаем автопроверку и сохраняем результат для преподавателя.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json(null, 401);
  const admin = supabaseAdmin();
  if (!admin) return json(null); // автопроверка не настроена: работа просто ждёт преподавателя

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return json(null, 400);

  // выбираем от имени студента: RLS отдаст только его собственную работу
  const { data: sub } = await sb.from("submissions").select("id,user_id,subtopic_id,kind,text,audio_path,ai_report").eq("id", body.id).maybeSingle();
  if (!sub || sub.user_id !== user.id) return json(null, 404);
  if (sub.ai_report) return json(sub.ai_report as AiReport);

  // защита от перегрузки сервиса: не больше 10 автопроверок за 10 минут на студента
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin.from("submissions").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).not("ai_report", "is", null).gte("created_at", since);
  if ((count ?? 0) >= 10) return json(null);

  let report: AiReport | null = null;
  if (sub.kind === "writing") {
    report = await checkWriting(sub.text ?? "");
  } else if (sub.kind === "speaking" && sub.audio_path) {
    const { data: sec } = await sb.from("sections").select("content").eq("subtopic_id", sub.subtopic_id).eq("kind", "speaking").maybeSingle();
    const reference = ((sec?.content ?? {}) as Content).read_text?.trim();
    if (reference) {
      const { data: file } = await sb.storage.from("speaking").download(sub.audio_path);
      if (file) report = await checkPronunciation(Buffer.from(await file.arrayBuffer()), reference);
    }
  }
  if (!report) return json(null);

  await admin.from("submissions").update({ ai_report: report, ai_score: report.kind === "speaking" ? report.accuracy : null }).eq("id", sub.id);
  return json(report);
}
