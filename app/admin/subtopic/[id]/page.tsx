import Link from "next/link";
import { notFound } from "next/navigation";
import SectionEditor from "@/components/editor/SectionEditor";
import { requireStaff } from "@/lib/auth";
import { KINDS, type Content } from "@/lib/types";

export default async function SubtopicEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireStaff();
  const { data: sub } = await sb.from("subtopics").select("id,title,program_id").eq("id", id).maybeSingle();
  if (!sub) notFound();
  const { data: secs } = await sb.from("sections").select("kind,content").eq("subtopic_id", id);
  return (<div className="grid gap-5">
    <div>
      <Link href={`/admin/program/${sub.program_id}`} className="font-bold text-pink-700">← К программе</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{sub.title}</h1>
      <p className="mt-1 text-stone-500">Откройте раздел, заполните и нажмите «Сохранить раздел». Кнопка «Как увидит студент» покажет результат до сохранения.</p>
      <Link href={`/subtopic/${id}`} className="mt-2 inline-block font-bold text-pink-700 hover:underline">Открыть страницу как студент →</Link>
    </div>
    {KINDS.map((k) => (
      <SectionEditor key={k} subtopicId={id} kind={k} initial={((secs ?? []).find((x) => x.kind === k)?.content ?? {}) as Content} />))}
  </div>);
}
