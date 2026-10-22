export type Embed = { type: "iframe" | "video" | "link"; src: string } | null;

// Превращает ссылку в безопасный вариант показа: YouTube/Vimeo, прямой файл или обычная ссылка. Только https.
export function toEmbed(raw: string | undefined | null): Embed {
  const url = (raw ?? "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  const yt = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
  if (yt) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
  if (vm) return { type: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|ogg)(\?[^#]*)?(#.*)?$/i.test(url)) return { type: "video", src: url };
  return { type: "link", src: url };
}
