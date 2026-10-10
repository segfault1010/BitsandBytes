import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { RoleToggle } from "@/components/RoleToggle";
import { AS_OF, DATA_NOTICE } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CivicTrack: check before you dig",
  description:
    "A shared register of public works that flags coordination conflicts before a road is dug.",
};

const NAV = [
  { href: "/", label: "Registry" },
  { href: "/propose", label: "Propose work" },
  { href: "/coordination", label: "Coordination" },
  { href: "/about", label: "How it works" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="bg-amber-100 text-amber-950 text-sm px-4 py-1.5 text-center" role="note">
          {DATA_NOTICE} Demo date: {formatDate(AS_OF, true)}.
        </div>
        <header className="border-b border-black/10 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="font-semibold text-lg">
            CivicTrack
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:underline">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <RoleToggle />
          </div>
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
