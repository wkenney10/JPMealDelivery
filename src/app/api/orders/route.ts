import { NextResponse } from "next/server";
import { translator } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { checkoutSchema, placeOrder } from "@/lib/orders";

export async function POST(req: Request) {
  const locale = await getLocale();
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: translator(locale)("errors.invalidOrder") }, { status: 400 });
  }
  const result = await placeOrder(parsed.data, new Date(), locale);
  return NextResponse.json(result, { status: result.ok ? 201 : 422 });
}
