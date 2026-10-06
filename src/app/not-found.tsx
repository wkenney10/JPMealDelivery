import Link from "next/link";
import { getTranslator } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getTranslator();
  return (
    <div className="py-20 text-center">
      <h1 className="font-display text-4xl">{t("notFound.title")}</h1>
      <p className="mt-3 font-serif italic text-muted">{t("notFound.text")}</p>
      <Link href="/" className="btn mt-6">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
