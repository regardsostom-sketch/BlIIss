"use client";
import { createContext, useContext } from "react";
import { tr, type Key, type Lang, type Vars } from "@/lib/i18n";

const Ctx = createContext<Lang>("ru");
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
export function useT() {
  const lang = useContext(Ctx);
  return (k: Key, v?: Vars) => tr(lang, k, v);
}
