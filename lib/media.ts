export type MediaKind = "video" | "audio";
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // лимит бесплатного тарифа Supabase

const TYPES: Record<MediaKind, Record<string, string>> = {
  video: { mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg" },
  audio: { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", webm: "audio/webm" },
};
export const ACCEPT: Record<MediaKind, string> = {
  video: ".mp4,.webm,.ogg,video/mp4,video/webm,video/ogg",
  audio: ".mp3,.m4a,.wav,.ogg,.aac,.webm,audio/*",
};
export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

// Возвращает текст ошибки или null, если файл подходит
export function checkMedia(kind: MediaKind, name: string, size: number): string | null {
  const ext = extOf(name);
  if (!TYPES[kind][ext]) return `Этот формат не подходит. Загрузите файл ${Object.keys(TYPES[kind]).map((e) => "." + e).join(", ")}.`;
  if (size > MAX_MEDIA_BYTES) return "Файл больше 50 МБ. Для длинных видео загрузите ролик на YouTube и вставьте ссылку.";
  if (size === 0) return "Файл пустой.";
  return null;
}
export const mediaType = (kind: MediaKind, name: string) => TYPES[kind][extOf(name)] ?? "application/octet-stream";

// Случайное имя: ссылку на файл нельзя угадать
export function mediaPath(subtopicId: string, name: string, id: string = crypto.randomUUID()) {
  return `${subtopicId}/${id}.${extOf(name)}`;
}
