export type Kind = "grammar" | "vocabulary" | "listening" | "reading" | "writing" | "speaking";
export const KINDS: Kind[] = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];
export const KIND_RU: Record<Kind, string> = {
  grammar: "Грамматика", vocabulary: "Лексика", listening: "Аудирование",
  reading: "Чтение", writing: "Письмо", speaking: "Говорение",
};
export const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

export type Role = "student" | "teacher" | "admin";
export type Profile = { id: string; name: string | null; role: Role; level: string | null; program_id: string | null };
export type Program = { id: string; level: string; title: string; title_kk: string | null; descr: string | null; published: boolean; owner: string | null };
export type Topic = { id: string; program_id: string; position: number; title: string; title_kk: string | null };
export type Subtopic = { id: string; topic_id: string; program_id: string; position: number; title: string; title_kk: string | null };

export type Gap = { text: string; answer: string };            // text содержит ___
export type Word = { en: string; ru: string; kk?: string };
export type Question = { q: string; options: string[]; correct: number };
export type Content = {
  video_url?: string;                            // grammar, listening (YouTube, Vimeo или ссылка на файл)
  explanation?: string; explanation_kk?: string; gaps?: Gap[];   // grammar
  words?: Word[];                                // vocabulary
  text?: string; audio_url?: string; questions?: Question[]; // reading, listening
  task?: string; task_kk?: string;               // writing, speaking
  read_text?: string;                            // speaking: фраза для чтения вслух (автопроверка произношения, по-английски)
};
