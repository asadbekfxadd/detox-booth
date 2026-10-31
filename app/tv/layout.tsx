import type { Metadata, Viewport } from "next";
import "./tv.css";

export const metadata: Metadata = { title: "ТВ-меню", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#072d17" };

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return children;
}
