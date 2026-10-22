import Link from "next/link";
import { getT } from "@/lib/lang";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto grid max-w-xl gap-4 rounded-2xl border border-pink-200 bg-white p-6">
      <h1 className="text-2xl font-extrabold">{t("nf_title")}</h1>
      <p className="text-stone-600">{t("nf_text")}</p>
      <Link href="/" className="justify-self-start rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("go_home")}</Link>
    </div>);
}
