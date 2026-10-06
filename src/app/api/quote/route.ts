import { NextResponse } from "next/server";
import { z } from "zod";
import { getLocale } from "@/i18n/server";
import { cartLineSchema, quote } from "@/lib/orders";

const bodySchema = z.object({ lines: z.array(cartLineSchema).max(100) });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  return NextResponse.json(quote(parsed.data.lines, await getLocale()));
}
