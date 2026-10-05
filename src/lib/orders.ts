import { randomInt } from "node:crypto";
import { z } from "zod";
import { isDeliverableZip, normalizePhone, normalizeZip } from "./address";
import { getMenu, getRestaurant } from "./data";
import { prisma } from "./db";
import { quoteCart, type Quote } from "./pricing";
import { validateDelivery } from "./schedule";

export const cartLineSchema = z.object({
  key: z.string().max(100),
  restaurant: z.string().max(100),
  itemId: z.string().max(200),
  quantity: z.number().int().min(1).max(50),
  optionIds: z.array(z.string().max(200)).max(100),
  notes: z.string().max(300).optional(),
});

export const checkoutSchema = z.object({
  lines: z.array(cartLineSchema).min(1, "Your cart is empty.").max(100),
  customer: z.object({
    name: z.string().trim().min(1, "Enter your name.").max(100),
    phone: z.string().trim().min(1, "Enter your phone number.").max(30),
    email: z.string().trim().email("Enter a valid email.").max(200),
    street: z.string().trim().min(3, "Enter your street address.").max(200),
    unit: z.string().trim().max(50).optional(),
    zip: z.string().trim().max(10),
    notes: z.string().trim().max(500).optional(),
  }),
  deliveryDate: z.string(),
  deliverySlot: z.string(),
  expectedTotal: z.number().int(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type PlaceOrderResult =
  | { ok: true; code: string }
  | { ok: false; error: string; quote?: Quote };

// No 0/O/1/I so codes are easy to read over the phone.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function newCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export function quote(lines: CheckoutInput["lines"]): Quote {
  return quoteCart(lines, getRestaurant, getMenu);
}

export async function placeOrder(input: CheckoutInput, now = new Date()): Promise<PlaceOrderResult> {
  const { customer } = input;
  if (!isDeliverableZip(customer.zip)) {
    return { ok: false, error: "Sorry, we only deliver within Jamaica Plain (ZIP 02130) right now." };
  }
  const phone = normalizePhone(customer.phone);
  if (!phone) return { ok: false, error: "Enter a 10-digit US phone number." };

  const q = quote(input.lines);
  if (q.errors.length) return { ok: false, error: q.errors[0], quote: q };
  if (!q.restaurants.length) return { ok: false, error: "Your cart is empty." };

  const restaurants = q.restaurants.map((g) => getRestaurant(g.restaurant.slug)!);
  const scheduleError = validateDelivery(now, input.deliveryDate, input.deliverySlot, restaurants);
  if (scheduleError) return { ok: false, error: scheduleError };

  if (q.total !== input.expectedTotal) {
    return {
      ok: false,
      error: "Menu prices changed since you added these items. Please review the updated total.",
      quote: q,
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await prisma.order.create({
        data: {
          code,
          customerName: customer.name,
          phone,
          email: customer.email,
          street: customer.street,
          unit: customer.unit || null,
          zip: normalizeZip(customer.zip),
          deliveryNotes: customer.notes || null,
          deliveryDate: input.deliveryDate,
          deliverySlot: input.deliverySlot,
          subtotal: q.subtotal,
          tax: q.tax,
          serviceFee: q.serviceFee,
          deliveryFee: q.deliveryFee,
          total: q.total,
          restaurantOrders: {
            create: q.restaurants.map((g) => ({
              restaurantSlug: g.restaurant.slug,
              restaurantName: g.restaurant.name,
              orderUrl: g.restaurant.orderUrl,
              subtotal: g.subtotal,
              tax: g.tax,
              serviceFee: g.serviceFee,
              deliveryFee: g.deliveryFee,
              total: g.total,
              items: {
                create: g.lines.map((l) => ({
                  itemId: l.itemId,
                  name: l.name,
                  options: JSON.stringify(l.options),
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  lineTotal: l.lineTotal,
                  notes: l.notes ?? null,
                })),
              },
            })),
          },
        },
      });
      return { ok: true, code };
    } catch (e) {
      // Retry only on a code collision.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  return { ok: false, error: "Something went wrong placing your order. Please try again." };
}

export const ORDER_STATUSES = ["received", "in_progress", "out_for_delivery", "delivered", "cancelled"] as const;
export const RESTAURANT_ORDER_STATUSES = ["to_place", "placed", "picked_up"] as const;

export const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  in_progress: "Placing orders",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  to_place: "To place",
  placed: "Placed with restaurant",
  picked_up: "Picked up",
};
