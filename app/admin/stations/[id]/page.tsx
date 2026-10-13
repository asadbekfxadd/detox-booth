import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { updateStationAction } from "../actions";

export default async function EditStationPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("products.edit");
  const { id } = await params;
  const s = await prisma.station.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">{s.name}</h1>
      <FormShell action={updateStationAction} submitLabel="Сохранить" cancelHref="/admin/stations">
        <input type="hidden" name="id" value={s.id} />
        <Field label="Название"><input name="name" required maxLength={30} defaultValue={s.name} className={fieldClass} /></Field>
        <Field label="Порядок (меньше — левее)"><input name="sort" type="number" min="0" step="1" defaultValue={s.sort} className={fieldClass} /></Field>
      </FormShell>
    </div>
  );
}
