import { toEmbed } from "@/lib/video";

export default function Video({ url }: { url?: string }) {
  const e = toEmbed(url);
  if (!e) return null;
  if (e.type === "iframe")
    return (<div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <iframe src={e.src} title="Video" className="h-full w-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>);
  if (e.type === "video") return <video controls playsInline preload="metadata" src={e.src} className="aspect-video w-full rounded-2xl bg-black" />;
  return <a href={e.src} target="_blank" rel="noopener noreferrer" className="font-bold text-pink-700 underline">▶ Video</a>;
}
