/** Автопечать чека после продажи на кассе. По умолчанию включена: выключается только явно (в хранилище "0"). */
export const POS_AUTOPRINT_KEY = "pos.autoprint";
export const autoPrintOn = (stored: string | null | undefined): boolean => stored !== "0";

/** Адрес чека для печати. embedded=true: страница откроется внутри скрытой рамки и сама вызовет печать. */
export const receiptPath = (orderId: string, embedded: boolean): string => `/print/order/${encodeURIComponent(orderId)}${embedded ? "?auto=1" : ""}`;
