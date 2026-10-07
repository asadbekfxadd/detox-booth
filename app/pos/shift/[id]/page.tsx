import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getShiftReport } from "@/services/pos";
import { ShiftSummaryView } from "@/components/pos/ShiftSummary";

export default async function ShiftReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageGuard("pos.use");
  const { id } = await params;
  const s = await getShiftReport(id, user);
  if (!s) notFound();
  return (
    <main className="min-h-screen bg-[#f7f3ea] p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Отчёт по смене</h1>
        <ShiftSummaryView s={s} />
        <Link href="/pos" className="inline-block rounded-xl bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">Открыть новую смену</Link>
      </div>
    </main>
  );
}
