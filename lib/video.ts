/**
 * Видео «Как готовим». Владелец вставляет ссылку, мы определяем, как её показать:
 * file — прямой файл (.mp4, .webm), играет в нашем плеере; youtube — встроенный плеер (грузится только по нажатию);
 * link — любая другая страница с видео (например, Instagram), открывается в новой вкладке.
 * Только https: http-ссылки на видео браузер заблокирует как небезопасные. Файл на самом сайте задаётся путём вида /videos/mango.mp4.
 */
export type Video =
  | { kind: "file"; src: string }
  | { kind: "youtube"; id: string; embed: string; vertical: boolean }
  | { kind: "link"; src: string };

const YT_ID = /^[\w-]{11}$/;

export function parseVideo(raw: string | null | undefined): Video | null {
  if (!raw) return null;
  // свой файл на этом же сайте: /videos/mango.mp4
  const own = raw.trim();
  if (/^\/(?!\/)[\w\-./%]*\.(mp4|webm|m4v|mov)$/i.test(own)) return { kind: "file", src: own };
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");

  let id: string | null = null, vertical = false;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") { id = parts[1] ?? null; vertical = parts[0] === "shorts"; }
  }
  if (id && YT_ID.test(id)) {
    return { kind: "youtube", id, vertical, embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1` };
  }
  if (host.endsWith("youtube.com") || host === "youtu.be") return { kind: "link", src: u.toString() };
  if (/\.(mp4|webm|m4v|mov)$/i.test(u.pathname)) return { kind: "file", src: u.toString() };
  return { kind: "link", src: u.toString() };
}
