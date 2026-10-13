import { notFound } from "next/navigation";
import { pageGuard, formLocations } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FormShell } from "@/components/admin/ops";
import { ZoneFields } from "@/components/admin/ZoneFields";
import { updateZoneAction } from "../actions";

export default async function EditZonePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageGuard("settings.edit");
  const { id } = await params;
  const z = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!z || (user.locationId && user.locationId !== z.locationId && user.role !== "OWNER")) notFound();
  const { options } = await formLocations();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">{z.name}</h1>
      <FormShell action={updateZoneAction} submitLabel="Сохранить" cancelHref="/admin/delivery/zones">
        <input type="hidden" name="id" value={z.id} />
        <ZoneFields lockLocation locations={options} z={{ locationId: z.locationId, name: z.name, fee: Number(z.fee), minOrder: Number(z.minOrder), freeFrom: z.freeFrom == null ? null : Number(z.freeFrom), sort: z.sort, isActive: z.isActive }} />
      </FormShell>
    </div>
  );
}
