import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, mediaPath, sniffImage } from "@/lib/media";

/** Сохранить загруженное фото. Тип определяем по содержимому. Возвращает адрес для Product.image. */
export async function saveImage(bytes: Uint8Array, userId: string): Promise<{ id: string; url: string }> {
  if (bytes.length === 0) throw new ApiError(400, "Файл пустой");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "Фото слишком большое: не больше 3 МБ");
  const mime = sniffImage(bytes);
  if (!mime) throw new ApiError(400, "Подойдут только фото JPG, PNG или WebP");
  const row = await prisma.mediaFile.create({ data: { mime, data: Buffer.from(bytes), size: bytes.length, userId }, select: { id: true } });
  return { id: row.id, url: mediaPath(row.id) };
}

export async function getImage(id: string) {
  return prisma.mediaFile.findUnique({ where: { id }, select: { mime: true, data: true, size: true, createdAt: true } });
}
