import { NextResponse } from "next/server";
import { checkoutSchema, placeOrder } from "@/lib/orders";

export async function POST(req: Request) {
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order." }, { status: 400 });
  }
  const result = await placeOrder(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 201 : 422 });
}
