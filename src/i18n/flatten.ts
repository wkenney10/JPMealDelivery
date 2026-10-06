/** Flattens nested messages into { "cart.title": "Your order", "header.items.one": "…" }. */
export function flatten(node: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof node === "string") {
    out[prefix] = node;
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}
