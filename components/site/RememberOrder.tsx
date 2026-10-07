"use client";
import { useEffect } from "react";
import { rememberOrder } from "@/lib/order-history";

/** Запоминает открытый заказ в истории браузера (например, если ссылку прислали с другого устройства). */
export function RememberOrder({ id }: { id: string }) {
  useEffect(() => { rememberOrder(id); }, [id]);
  return null;
}
