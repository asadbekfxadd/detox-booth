import { pageGuard, formLocations } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getOpenShift, getCatalog } from "@/services/pos";
import { OpenShiftForm } from "@/components/pos/ShiftForms";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { openShiftAction } from "./actions";

export default async function PosPage() {
  const user = await pageGuard("pos.use");
  const shift = await getOpenShift(user.id);
  if (!shift) {
    const { options, defaultId } = await formLocations();
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f3ea] p-6">
        <OpenShiftForm action={openShiftAction} locations={options} defaultLocationId={defaultId} cashier={user.name ?? ""} />
      </main>
    );
  }
  const catalog = await getCatalog(shift.locationId);
  return (
    <PosTerminal
      catalog={catalog} locationName={shift.location.name} cashier={user.name ?? ""}
      canRefund={can(user.role, "pos.refund")} adminHref={can(user.role, "dashboard.view") ? "/admin/dashboard" : null}
    />
  );
}
