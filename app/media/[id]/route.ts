import { MEDIA_ID_RE } from "@/lib/media";
import { getImage } from "@/services/media";

/** Отдаёт загруженное фото. Публично: фото продуктов видят все гости сайта. Адрес уникален, поэтому кэш вечный. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!MEDIA_ID_RE.test(id)) return new Response("Not found", { status: 404 });
  const img = await getImage(id);
  if (!img) return new Response("Not found", { status: 404 });
  const etag = `"${id}"`;
  const headers = { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable", ETag: etag, "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(img.data), { headers: { ...headers, "Content-Length": String(img.size) } });
}
