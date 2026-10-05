import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "jpmd_admin";

function secret(): string | undefined {
  return process.env.ADMIN_PASSWORD || undefined;
}

function token(password: string): string {
  return createHmac("sha256", password).update("jpmd-admin-session").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function isAdmin(): Promise<boolean> {
  const pw = secret();
  if (!pw) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && safeEqual(value, token(pw));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** Returns false when the password is wrong or no ADMIN_PASSWORD is configured. */
export async function logIn(password: string): Promise<boolean> {
  const pw = secret();
  if (!pw || !safeEqual(password, pw)) return false;
  (await cookies()).set(COOKIE, token(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return true;
}

export async function logOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
