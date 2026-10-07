import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getTableByToken } from "@/services/tables";
import { TABLE_COOKIE } from "@/lib/tables";

export const SITE_LOC_COOKIE = "site_loc";

/** Активные точки и выбранная клиентом точка (cookie), по умолчанию — первая. */
export const getSiteLocation = cache(async () => {
  const jar = await cookies();
  // за столом точка всегда та, где стоит стол, что бы ни было в выборе точки
  const table = jar.get(TABLE_COOKIE)?.value ? await getTableByToken(jar.get(TABLE_COOKIE)?.value) : null;
  const c = table?.locationId ?? jar.get(SITE_LOC_COOKIE)?.value;
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, phone: true, lat: true, lng: true } });
  const current = locations.find((l) => l.id === c) ?? locations[0] ?? null;
  return { locations, current };
});
