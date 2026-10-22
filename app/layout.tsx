import "./globals.css";
import Link from "next/link";
import { cookies } from "next/headers";
import Flash from "@/components/Flash";
import { LangProvider } from "@/components/LangProvider";
import { getMe } from "@/lib/auth";
import { getT } from "@/lib/lang";
import { setLang, signOut } from "./actions";
export const metadata = { title: "BLISS Academy · BLISS Language Academy" };
export default async function Root({ children }: { children: React.ReactNode }) {
  const { user, me } = await getMe();
  const { lang, t } = await getT();
  const flash = (await cookies()).get("flash")?.value ?? "";
  const staff = me?.role === "teacher" || me?.role === "admin";
  const nav = "font-bold text-stone-600 hover:text-pink-700";
  const lb = (active: boolean) => `px-2 py-1 text-sm font-bold ${active ? "bg-pink-600 text-white" : "bg-white text-stone-600"}`;
  return (
    <html lang={lang}><body className="bg-rose-50 text-stone-900 antialiased">
      <LangProvider lang={lang}>
        <header className="sticky top-0 z-10 border-b border-pink-200 bg-white">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
            <Link href="/" className="text-xl font-extrabold">BLISS<span className="text-pink-700"> Academy</span></Link>
            <span className="flex-1" />
            <div className="flex overflow-hidden rounded-lg border-2 border-pink-200">
              <form action={setLang.bind(null, "ru")}><button className={lb(lang === "ru")}>РУС</button></form>
              <form action={setLang.bind(null, "kk")}><button className={lb(lang === "kk")}>ҚАЗ</button></form>
            </div>
            {user ? (<>
              {staff ? (<><Link href="/admin" className={nav}>{t("nav_programs")}</Link><Link href="/admin/students" className={nav}>{t("nav_students")}</Link><Link href="/admin/submissions" className={nav}>{t("nav_work")}</Link></>)
                : <Link href="/cabinet" className={nav}>{t("nav_cabinet")}</Link>}
              <form action={signOut}><button className="font-bold text-pink-700">{t("logout")}</button></form></>)
              : <Link href="/login" className="rounded-xl bg-pink-600 px-4 py-2 font-bold text-white shadow-[0_4px_0] shadow-pink-800">{t("login")}</Link>}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8"><Flash message={flash} />{children}</main>
      </LangProvider>
    </body></html>
  );
}
