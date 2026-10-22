import { cookies } from "next/headers";
import { tr, type Key, type Lang, type Vars } from "./i18n";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "kk" ? "kk" : "ru";
}
export async function getT() {
  const lang = await getLang();
  return { lang, t: (k: Key, v?: Vars) => tr(lang, k, v) };
}
