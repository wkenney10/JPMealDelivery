import type { Metadata } from "next";
import { IBM_Plex_Sans, Libre_Caslon_Display, Libre_Caslon_Text } from "next/font/google";
import Link from "next/link";
import { CartProvider } from "@/components/cart-context";
import { CartLink } from "@/components/cart-link";
import { BUSINESS_NAME } from "@/lib/config";
import "./globals.css";

const caslon = Libre_Caslon_Text({
  variable: "--font-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});
const caslonDisplay = Libre_Caslon_Display({ variable: "--font-caslon-display", subsets: ["latin"], weight: "400" });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: BUSINESS_NAME,
  description: "Dinner from Jamaica Plain restaurants, delivered 5–9pm. Menu prices, plus $5 per restaurant.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${caslon.variable} ${caslonDisplay.variable} ${plex.variable} font-sans antialiased`}>
        <CartProvider>
          <header className="sticky top-0 z-20 bg-paper">
            <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-4 pt-4 pb-3 sm:px-6">
              <Link href="/" className="font-display text-2xl leading-none tracking-tight sm:text-[1.7rem]">
                {BUSINESS_NAME}
              </Link>
              <CartLink />
            </div>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="rule-double" />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
            <div className="rule-double pt-4 text-center text-sm text-muted">
              <span className="smallcaps">Jamaica Plain · ZIP 02130</span>
              <span className="mx-2">✦</span>
              <span className="smallcaps">Orders by 4 PM · Delivered 5 – 9 PM</span>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
