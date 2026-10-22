import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { LEVELS } from "@/lib/types";
export default async function Home() {
  const { user, me } = await getMe();
  if (user) redirect(me && me.role !== "student" ? "/admin" : "/cabinet");
  const { t } = await getT();
  return (<div className="grid gap-6 py-6">
    <h1 className="text-4xl font-extrabold sm:text-5xl">{t("home_h1a")}<span className="text-pink-700">{t("home_h1b")}</span>{t("home_h1c")}</h1>
    <p className="max-w-2xl text-lg text-stone-600">{t("home_p")}</p>
    <div className="flex flex-wrap gap-2">{LEVELS.map((l) => <span key={l} className="rounded-full bg-pink-100 px-4 py-1 font-bold text-pink-700">{l}</span>)}</div>
    <Link href="/login?mode=up" className="justify-self-start rounded-xl bg-pink-600 px-6 py-3 text-lg font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("start")}</Link>
  </div>);
}
