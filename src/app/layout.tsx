import type { Metadata } from "next";
import { IBM_Plex_Sans, Libre_Caslon_Display, Libre_Caslon_Text } from "next/font/google";
import Link from "next/link";
import { CartProvider } from "@/components/cart-context";
import { CartLink } from "@/components/cart-link";
import { I18nProvider, LanguageToggle } from "@/i18n/client";
import { getTranslator } from "@/i18n/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: BUSINESS_NAME, description: t("meta.description") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, t } = await getTranslator();
  return (
    <html lang={locale}>
      <body className={`${caslon.variable} ${caslonDisplay.variable} ${plex.variable} font-sans antialiased`}>
        <I18nProvider locale={locale}>
        <CartProvider>
          <header className="sticky top-0 z-20 bg-paper">
            <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-4 pt-4 pb-3 sm:px-6">
              <Link href="/" className="font-display text-2xl leading-none tracking-tight sm:text-[1.7rem]">
                {BUSINESS_NAME}
              </Link>
              <div className="flex items-baseline gap-5">
                <LanguageToggle />
                <CartLink />
              </div>
            </div>
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="rule-double" />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
            <div className="rule-double pt-4 text-center text-sm text-muted">
              <span className="smallcaps">{t("footer.area")}</span>
              <span className="mx-2">✦</span>
              <span className="smallcaps">{t("footer.hours")}</span>
            </div>
          </footer>
        </CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
