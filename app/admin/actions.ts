"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { isFilled, validate } from "@/lib/validate";
import { KINDS, LEVELS, type Kind } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Понятный текст вместо технических сообщений базы данных
function friendly(m: string): string {
  if (/row-level security|permission denied|forbidden/i.test(m)) return "Нет прав на это действие.";
  if (/duplicate key|already exists/i.test(m)) return "Такая запись уже есть.";
  if (/foreign key/i.test(m)) return "Связанная запись не найдена (возможно, её уже удалили). Обновите страницу.";
  if (/fetch failed|network|timeout|ECONN/i.test(m)) return "Нет связи с базой данных. Попробуйте ещё раз через минуту.";
  return m;
}

// Ошибка действия: текст показывается плашкой сверху страницы (cookie "flash"), а не безликой страницей ошибки.
// Преподаватель остаётся на той же странице, введённое в других полях не теряется.
async function fail(m: string): Promise<never> {
  (await cookies()).set("flash", friendly(m), { path: "/", maxAge: 60, sameSite: "lax" });
  let back = "/admin";
  try {
    const ref = (await headers()).get("referer");
    if (ref) { const u = new URL(ref); back = u.pathname + u.search; }
  } catch { /* остаёмся на /admin */ }
  return redirect(back);
}

export async function createProgram(fd: FormData) {
  const { sb, user } = await requireStaff();
  const level = str(fd, "level"), title = str(fd, "title");
  if (!LEVELS.includes(level) || !title) await fail("Укажите уровень и название программы");
  const { error } = await sb.from("programs").insert({ level, title, title_kk: str(fd, "title_kk") || null, descr: str(fd, "descr") || null, owner: user.id });
  if (error) await fail(error.message);
  revalidatePath("/admin");
}

export async function publishProgram(fd: FormData) {
  const { sb } = await requireStaff();
  const id = str(fd, "program_id");
  const { error } = await sb.rpc("publish_program", { pid: id, flag: str(fd, "flag") === "true" });
  if (error) await fail(error.message);
  revalidatePath(`/admin/program/${id}`); revalidatePath("/admin");
}

async function nextPosition(sb: Awaited<ReturnType<typeof requireStaff>>["sb"], table: "topics" | "subtopics", col: string, val: string) {
  const { data } = await sb.from(table).select("position").eq(col, val).order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}

export async function addTopic(fd: FormData) {
  const { sb } = await requireStaff();
  const program = str(fd, "program_id"), title = str(fd, "title");
  if (!title) return;
  const { error } = await sb.from("topics").insert({ program_id: program, title, position: await nextPosition(sb, "topics", "program_id", program) });
  if (error) await fail(error.message);
  revalidatePath(`/admin/program/${program}`);
}

export async function addSubtopic(fd: FormData) {
  const { sb } = await requireStaff();
  const topic = str(fd, "topic_id"), title = str(fd, "title");
  if (!title) return;
  const { error } = await sb.from("subtopics").insert({ topic_id: topic, title, position: await nextPosition(sb, "subtopics", "topic_id", topic) });
  if (error) await fail(error.message);
  revalidatePath(`/admin/program/${str(fd, "program_id")}`);
}

export async function rename(fd: FormData) {
  const { sb } = await requireStaff();
  const table = str(fd, "table") === "subtopics" ? "subtopics" : "topics";
  const title = str(fd, "title");
  if (!title) return;
  const { data, error } = await sb.from(table).update({ title, title_kk: str(fd, "title_kk") || null }).eq("id", str(fd, "id")).select("id");
  if (error) await fail(error.message);
  if (!data?.length) await fail("Не удалось переименовать: нет прав или запись уже удалена.");
  revalidatePath(`/admin/program/${str(fd, "program_id")}`);
}

export async function remove(fd: FormData) {
  const { sb } = await requireStaff();
  const table = str(fd, "table") === "subtopics" ? "subtopics" : "topics";
  const { data, error } = await sb.from(table).delete().eq("id", str(fd, "id")).select("id");
  if (error) await fail(error.message);
  if (!data?.length) await fail("Не удалось удалить: нет прав или запись уже удалена.");
  revalidatePath(`/admin/program/${str(fd, "program_id")}`);
}

// Меняет местами соседние темы или подтемы
export async function move(fd: FormData) {
  const { sb } = await requireStaff();
  const table = str(fd, "table") === "subtopics" ? "subtopics" : "topics";
  const parent = table === "topics" ? "program_id" : "topic_id";
  const down = str(fd, "dir") === "down";
  const { data: row } = await sb.from(table).select(`id,position,${parent}`).eq("id", str(fd, "id")).single();
  if (!row) return;
  const q = sb.from(table).select("id,position").eq(parent, row[parent]);
  const { data: nb } = await (down ? q.gt("position", row.position) : q.lt("position", row.position)).order("position", { ascending: down }).limit(1);
  const n = nb?.[0];
  if (!n) return;
  const a = await sb.from(table).update({ position: n.position }).eq("id", row.id);
  const b = await sb.from(table).update({ position: row.position }).eq("id", n.id);
  if (a.error || b.error) await fail((a.error ?? b.error)!.message);
  revalidatePath(`/admin/program/${str(fd, "program_id")}`);
}

export type SaveResult = { ok: boolean; errors: string[]; warnings: string[] };

// Сохраняет раздел из конструктора: данные заново проверяются на сервере
export async function saveSectionContent(subtopicId: string, kind: string, raw: unknown): Promise<SaveResult> {
  const { sb } = await requireStaff();
  if (!KINDS.includes(kind as Kind)) return { ok: false, errors: ["Неизвестный раздел"], warnings: [] };
  const k = kind as Kind;
  const r = validate(k, raw);
  if (r.errors.length) return { ok: false, errors: r.errors, warnings: r.warnings };
  const { data, error } = await sb.from("sections").update({ content: r.content, filled: isFilled(k, r.content) })
    .eq("subtopic_id", subtopicId).eq("kind", k).select("id");
  if (error) return { ok: false, errors: [friendly(error.message)], warnings: [] };
  if (!data?.length) return { ok: false, errors: ["Не удалось сохранить: нет прав или раздел не найден"], warnings: [] };
  revalidatePath(`/admin/subtopic/${subtopicId}`);
  return { ok: true, errors: [], warnings: r.warnings };
}

// Копия подтемы (с содержанием) в той же теме
export async function duplicateSubtopic(fd: FormData) {
  const { sb } = await requireStaff();
  const id = str(fd, "id");
  const { data: src } = await sb.from("subtopics").select("topic_id,title,title_kk").eq("id", id).single();
  if (!src) return fail("Подтема не найдена");
  const position = await nextPosition(sb, "subtopics", "topic_id", src.topic_id);
  const { data: created, error } = await sb.from("subtopics").insert({
    topic_id: src.topic_id, position, title: `${src.title} (копия)`, title_kk: src.title_kk ? `${src.title_kk} (көшірме)` : null,
  }).select("id").single();
  if (error || !created) return fail(error?.message ?? "Не удалось создать копию");
  const { data: secs } = await sb.from("sections").select("kind,content,filled").eq("subtopic_id", id);
  for (const sc of secs ?? []) {
    const { error: e } = await sb.from("sections").update({ content: sc.content, filled: sc.filled }).eq("subtopic_id", created.id).eq("kind", sc.kind);
    if (e) await fail(e.message);
  }
  revalidatePath(`/admin/program/${str(fd, "program_id")}`);
}

export async function assignProgram(fd: FormData) {
  const { sb } = await requireStaff();
  const { error } = await sb.rpc("assign_program", { uid: str(fd, "student_id"), pid: str(fd, "program_id") });
  if (error) await fail(error.message);
  revalidatePath("/admin/students");
}

export async function review(fd: FormData) {
  const { sb } = await requireStaff();
  const status = str(fd, "status") === "revise" ? "revise" : "accepted";
  const { data, error } = await sb.from("submissions").update({
    status, teacher_feedback: str(fd, "feedback"), reviewed_at: new Date().toISOString(),
  }).eq("id", str(fd, "id")).select("id");
  if (error) await fail(error.message);
  if (!data?.length) await fail("Не удалось сохранить проверку: нет прав или работа не найдена.");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/students");
}
