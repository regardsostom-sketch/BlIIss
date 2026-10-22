import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/auth";
import type { Program, Subtopic, Topic } from "@/lib/types";
import { addSubtopic, addTopic, duplicateSubtopic, move, publishProgram, remove, rename } from "../../actions";

const btn = "rounded-lg border-2 border-pink-200 bg-white px-3 py-1 text-sm font-bold";
const inp = "min-w-0 flex-1 rounded-xl border-2 border-pink-200 bg-white px-3 py-2";

function Hidden({ table, id, program }: { table: string; id: string; program: string }) {
  return <><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="program_id" value={program} /></>;
}
function Controls({ table, id, program }: { table: string; id: string; program: string }) {
  return (<div className="flex gap-1">
    <form action={move}><Hidden table={table} id={id} program={program} /><input type="hidden" name="dir" value="up" /><button className={btn} aria-label="Выше">↑</button></form>
    <form action={move}><Hidden table={table} id={id} program={program} /><input type="hidden" name="dir" value="down" /><button className={btn} aria-label="Ниже">↓</button></form>
    <form action={remove}><Hidden table={table} id={id} program={program} />
      <ConfirmButton message={table === "topics" ? "Удалить тему вместе со всеми подтемами и прогрессом студентов?" : "Удалить подтему вместе с содержанием и прогрессом студентов?"} className={`${btn} text-red-700`}>Удалить</ConfirmButton></form>
  </div>);
}

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await requireStaff();
  const { data: program } = await sb.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) notFound();
  const [{ data: topics }, { data: subs }] = await Promise.all([
    sb.from("topics").select("*").eq("program_id", id).order("position"),
    sb.from("subtopics").select("*").eq("program_id", id).order("position"),
  ]);
  const p = program as Program; const T = (topics ?? []) as Topic[]; const S = (subs ?? []) as Subtopic[];
  return (<div className="grid gap-5">
    <div><Link href="/admin" className="font-bold text-pink-700">← Все программы</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{p.level} · {p.title}</h1></div>
    <form action={publishProgram} className="flex flex-wrap items-center gap-3 rounded-2xl border border-pink-200 bg-white p-4">
      <input type="hidden" name="program_id" value={id} /><input type="hidden" name="flag" value={String(!p.published)} />
      <span className="font-bold">{p.published ? "Опубликована: студенты уровня " + p.level + " её видят" : "Черновик: студентам не видна"}</span>
      <span className="flex-1" />
      <button className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">{p.published ? "Снять с публикации" : "Опубликовать"}</button>
    </form>
    {T.map((t, ti) => (
      <section key={t.id} className="grid gap-3 rounded-2xl border border-pink-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-pink-700">{ti + 1}.</span>
          <form action={rename} className="flex min-w-0 flex-1 flex-wrap gap-2"><Hidden table="topics" id={t.id} program={id} />
            <input name="title" defaultValue={t.title} className={inp} /><input name="title_kk" defaultValue={t.title_kk ?? ""} className={inp} placeholder="Қазақша" /><button className={btn}>Сохранить</button></form>
          <Controls table="topics" id={t.id} program={id} />
        </div>
        <ul className="grid gap-2 pl-2 sm:pl-6">
          {S.filter((s) => s.topic_id === t.id).map((s, si) => (
            <li key={s.id} className="grid gap-2 rounded-xl border border-pink-100 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-stone-500">{ti + 1}.{si + 1}</span>
                <form action={rename} className="flex min-w-0 flex-1 flex-wrap gap-2"><Hidden table="subtopics" id={s.id} program={id} />
                  <input name="title" defaultValue={s.title} className={inp} /><input name="title_kk" defaultValue={s.title_kk ?? ""} className={inp} placeholder="Қазақша" /><button className={btn}>Сохранить</button></form>
                <Controls table="subtopics" id={s.id} program={id} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/admin/subtopic/${s.id}`} className="font-bold text-pink-700 hover:underline">Наполнить разделы →</Link>
                <form action={duplicateSubtopic}><Hidden table="subtopics" id={s.id} program={id} /><button className={btn}>Копировать подтему</button></form>
              </div>
            </li>))}
        </ul>
        <form action={addSubtopic} className="flex gap-2 pl-2 sm:pl-6">
          <input type="hidden" name="topic_id" value={t.id} /><input type="hidden" name="program_id" value={id} />
          <input name="title" required className={inp} placeholder="Новая подтема" /><button className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">Добавить</button>
        </form>
      </section>))}
    <form action={addTopic} className="flex gap-2 rounded-2xl border-2 border-dashed border-pink-300 p-4">
      <input type="hidden" name="program_id" value={id} />
      <input name="title" required className={inp} placeholder="Новая тема" /><button className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white">Добавить тему</button>
    </form>
  </div>);
}
