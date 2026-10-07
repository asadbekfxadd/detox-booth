import { cache } from "react";
import { cookies } from "next/headers";
import { getTableByToken, type TableInfo } from "@/services/tables";
import { TABLE_COOKIE } from "@/lib/tables";

/** Стол текущего гостя (из cookie, поставленной по QR) или null. Один запрос в БД на страницу. */
export const getCurrentTable = cache(async (): Promise<TableInfo | null> => {
  const token = (await cookies()).get(TABLE_COOKIE)?.value;
  return token ? getTableByToken(token) : null;
});
