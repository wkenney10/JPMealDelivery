import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { CartProvider } from "@/components/cart-context";
import { CartLink } from "@/components/cart-link";
import { BUSINESS_NAME } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BUSINESS_NAME,
  description: "Dinner from Jamaica Plain restaurants, delivered 5–9pm. Flat $5 per restaurant, menu prices.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <CartProvider>
          <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-lg font-bold tracking-tight text-brand">{BUSINESS_NAME}</span>
                <span className="hidden text-sm text-muted sm:inline">Dinner delivery in Jamaica Plain</span>
              </Link>
              <CartLink />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
          <footer className="border-t border-line py-8 text-center text-sm text-muted">
            Delivering to ZIP 02130 · Order by 4:00 PM · Delivery 5–9 PM
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
