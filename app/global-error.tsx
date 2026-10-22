"use client";
import "./globals.css";

// Последний рубеж: срабатывает, когда падает сам корневой шаблон (например, база данных недоступна).
// Здесь нет ни переводов, ни шапки, поэтому текст на двух языках.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body className="bg-rose-50 text-stone-900 antialiased">
        <main role="alert" className="mx-auto mt-16 grid max-w-xl gap-4 rounded-2xl border border-pink-200 bg-white p-6">
          <h1 className="text-2xl font-extrabold">Сайт временно недоступен · Сайт уақытша қолжетімсіз</h1>
          <p className="text-stone-600">Не удалось загрузить страницу. Подождите минуту и попробуйте ещё раз. Если ошибка повторяется, сообщите администратору.</p>
          <p className="text-stone-600">Бетті жүктеу мүмкін болмады. Бір минут күтіп, қайталап көріңіз. Қате қайталанса, әкімшіге хабарлаңыз.</p>
          {error.digest && <p className="text-sm text-stone-500">Код / Коды: {error.digest}</p>}
          <button onClick={reset} className="justify-self-start rounded-xl bg-pink-600 px-5 py-3 font-bold text-white shadow-[0_4px_0] shadow-pink-800">Повторить · Қайталау</button>
        </main>
      </body>
    </html>);
}
