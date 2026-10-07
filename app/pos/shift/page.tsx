import Link from "next/link";
import { redirect } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getOpenShift, shiftSummary } from "@/services/pos";
import { ShiftSummaryView } from "@/components/pos/ShiftSummary";
import { CloseShiftForm } from "@/components/pos/ShiftForms";
import { closeShiftAction } from "../actions";

export default async function CurrentShiftPage() {
  const user = await pageGuard("pos.use");
  const shift = await getOpenShift(user.id);
  if (!shift) redirect("/pos");
  const s = (await shiftSummary(shift.id))!;
  return (
    <main className="min-h-screen bg-[#f7f3ea] p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/pos" className="text-sm text-green-800 underline">← Назад в кассу</Link>
        <ShiftSummaryView s={s} />
        <CloseShiftForm action={closeShiftAction} expected={s.expectedCash} />
      </div>
    </main>
  );
}
