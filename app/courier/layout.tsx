import type { Metadata } from "next";

export const metadata: Metadata = { title: "Курьер", robots: { index: false, follow: false } };

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f7f3ea] text-neutral-900">{children}</div>;
}
