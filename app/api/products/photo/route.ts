import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { hit } from "@/lib/rate-limit";
import { saveImage } from "@/services/media";

/** Загрузка фото продукта: multipart, поле file. Только сотрудники с правом править продукты. */
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser("products.edit");
    if (!hit(`upload:${u.id}`, 60, 10 * 60_000).ok) throw new ApiError(429, "Слишком много загрузок подряд. Подождите пару минут.");
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > 4_000_000) throw new ApiError(413, "Фото слишком большое: не больше 3 МБ");
    const f = (await req.formData()).get("file");
    if (!(f instanceof File)) throw new ApiError(400, "Выберите файл с фото");
    return NextResponse.json(await saveImage(new Uint8Array(await f.arrayBuffer()), u.id), { status: 201 });
  } catch (e) { return handleError(e); }
}
