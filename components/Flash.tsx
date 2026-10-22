"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Плашка с сообщением об ошибке действия. Текст приходит из cookie "flash" (её ставит серверное действие),
// плашка показывается один раз, cookie тут же удаляется. При переходе на другую страницу плашка исчезает.
export default function Flash({ message }: { message: string }) {
  const path = usePathname();
  const [s, setS] = useState({ text: message, path });
  useEffect(() => {
    if (!message) return;
    setS({ text: message, path });
    document.cookie = "flash=; Max-Age=0; path=/";
  }, [message, path]);
  if (!s.text || s.path !== path) return null;
  return (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-red-800">
      <p className="flex-1 font-semibold">{s.text}</p>
      <button type="button" aria-label="Закрыть" onClick={() => setS({ text: "", path })} className="font-bold">✕</button>
    </div>);
}
