import Link from "next/link";
import { redirect } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getOpenShift, shiftSummary } from "@/services/pos";
import { ShiftSummaryView } from "@/components/pos/ShiftSummary";
import { CloseShiftForm, CashMovementForm } from "@/components/pos/ShiftForms";
import { CASH_REASONS } from "@/lib/cash";
import { closeShiftAction, cashMovementAction } from "../actions";

export default async function CurrentShiftPage({ searchParams }: { searchParams: Promise<{ cash?: string }> }) {
  const user = await pageGuard("pos.use");
  const { cash } = await searchParams;
  const shift = await getOpenShift(user.id);
  if (!shift) redirect("/pos");
  const s = (await shiftSummary(shift.id))!;
  return (
    <main className="min-h-screen bg-[#f7f3ea] p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/pos" className="text-sm text-green-800 underline">← Назад в кассу</Link>
        {cash === "ok" && <p role="status" className="rounded-xl bg-lime-100 px-4 py-3 font-semibold text-green-900">Записано. Касса пересчитана.</p>}
        <ShiftSummaryView s={s} />
        <CashMovementForm action={cashMovementAction} reasons={CASH_REASONS} />
        <CloseShiftForm action={closeShiftAction} expected={s.expectedCash} />
      </div>
    </main>
  );
}
