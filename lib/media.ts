/** Загруженные фото: проверка файла и адреса. Чистая логика без базы. */
export const MAX_UPLOAD_BYTES = 3_000_000;
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Тип по первым байтам, а не по расширению и заголовку: подделать имя файла легко. SVG и прочее не принимаем. */
export function sniffImage(b: Uint8Array): ImageMime | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  const s = (o: number, t: string) => [...t].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (s(0, "RIFF") && s(8, "WEBP")) return "image/webp";
  return null;
}

/** Адрес загруженного фото на нашем сайте */
export const mediaPath = (id: string) => `/media/${id}`;
export const MEDIA_ID_RE = /^[a-z0-9]{20,40}$/;
export const isMediaPath = (u: string) => /^\/media\/[a-z0-9]{20,40}$/.test(u);
