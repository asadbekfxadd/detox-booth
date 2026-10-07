"use client";
export function PrintButton({ label = "Распечатать" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="rounded-xl bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 print:hidden">{label}</button>;
}
