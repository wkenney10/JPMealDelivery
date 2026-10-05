"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logIn, logOut, requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ORDER_STATUSES, RESTAURANT_ORDER_STATUSES } from "@/lib/orders";

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  if (!process.env.ADMIN_PASSWORD) return "ADMIN_PASSWORD is not set on the server.";
  const ok = await logIn(String(formData.get("password") ?? ""));
  if (!ok) return "Wrong password.";
  redirect("/admin");
}

export async function logoutAction() {
  await logOut();
  redirect("/admin/login");
}

export async function setOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) return;
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}

export async function updateRestaurantOrder(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const confirmation = String(formData.get("confirmation") ?? "").trim().slice(0, 100);
  if (!(RESTAURANT_ORDER_STATUSES as readonly string[]).includes(status)) return;
  const ro = await prisma.restaurantOrder.update({
    where: { id },
    data: { status, confirmation: confirmation || null },
  });
  // Move the parent order along once we start placing restaurant orders.
  if (status !== "to_place") {
    await prisma.order.updateMany({ where: { id: ro.orderId, status: "received" }, data: { status: "in_progress" } });
  }
  revalidatePath("/admin");
}
