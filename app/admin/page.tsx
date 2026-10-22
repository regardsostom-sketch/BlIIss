import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { LEVELS, type Program } from "@/lib/types";
import { createProgram } from "./actions";

export default async function Admin() {
  const { sb, user, me } = await requireStaff();
  let q = sb.from("programs").select("*").order("level").order("created_at");
  if (me.role !== "admin") q = q.eq("owner", user.id);
  const { data } = await q;
  const programs = (data ?? []) as Program[];
  const f = "w-full rounded-xl border-2 border-pink-200 bg-white px-4 py-3";
  return (<div className="grid gap-6">
    <h1 className="text-3xl font-extrabold">Программы</h1>
    <div className="grid gap-3 sm:grid-cols-2">
      {programs.map((p) => (
        <Link key={p.id} href={`/admin/program/${p.id}`} className="grid gap-1 rounded-2xl border border-pink-200 bg-white p-5 hover:bg-pink-50">
          <span className="w-fit rounded-full bg-pink-100 px-3 py-0.5 text-sm font-bold text-pink-700">{p.level}</span>
          <span className="text-xl font-bold">{p.title}</span>
          <span className="text-sm text-stone-500">{p.published ? "Опубликована" : "Черновик: студентам не видна"}</span>
        </Link>))}
      {!programs.length && <p className="text-stone-500">Программ пока нет. Создайте первую ниже.</p>}
    </div>
    <form action={createProgram} className="grid max-w-xl gap-3 rounded-2xl border border-pink-200 bg-white p-5">
      <h2 className="text-xl font-bold">Новая программа</h2>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <select name="level" className={f}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        <input name="title" required className={f} placeholder="Название, например English A1" />
      </div>
      <input name="title_kk" className={f} placeholder="Қазақша атауы (необязательно)" />
      <input name="descr" className={f} placeholder="Описание (необязательно)" />
      <button className="justify-self-start rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">Создать</button>
    </form>
  </div>);
}
