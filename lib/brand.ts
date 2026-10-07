/** Контакты бренда, общие для всего сайта. */
export const INSTAGRAM_HANDLE = "vitaminb.uz";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

const strip = (s: string) => s.replace(/ташкент|tashkent|toshkent/gi, "").replace(/[\s,.\-]/g, "");

/** Точный адрес, а не просто город: только по такому адресу карта покажет нужное место. */
export const hasExactAddress = (address?: string | null) => !!address && strip(address).length >= 5;

/** Адрес уходит в карту как есть: город и район владелец пишет сам (Янгиюль — это не город Ташкент). */
const query = (address: string) => address;

export const mapEmbedUrl = (address: string) => `https://www.google.com/maps?q=${encodeURIComponent(query(address))}&hl=ru&z=16&output=embed`;
export const googleRouteUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query(address))}`;
export const yandexMapUrl = (address: string) => `https://yandex.uz/maps/?text=${encodeURIComponent(query(address))}`;
