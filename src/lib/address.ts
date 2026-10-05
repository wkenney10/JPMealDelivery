import { DELIVERY_ZIPS } from "./config";

export function normalizeZip(zip: string): string {
  return zip.trim().slice(0, 5);
}

export function isDeliverableZip(zip: string): boolean {
  return DELIVERY_ZIPS.includes(normalizeZip(zip));
}

export function normalizePhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : null;
}
