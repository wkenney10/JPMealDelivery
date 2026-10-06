import type { Menu, MenuCategory } from "../src/lib/types";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Human-readable list of what changed between two menus. */
export function diffMenus(before: MenuCategory[] | undefined, after: MenuCategory[]): string[] {
  if (!before) return [`New menu with ${after.reduce((n, c) => n + c.items.length, 0)} items`];
  const index = (cats: MenuCategory[]) => new Map(cats.flatMap((c) => c.items.map((i) => [i.name.toLowerCase(), i])));
  const a = index(before);
  const b = index(after);
  const changes: string[] = [];
  for (const [k, item] of b) {
    const old = a.get(k);
    if (!old) changes.push(`Added ${item.name} (${money(item.price)})`);
    else if (old.price !== item.price) changes.push(`${item.name}: ${money(old.price)} → ${money(item.price)}`);
  }
  for (const [k, item] of a) if (!b.has(k)) changes.push(`Removed ${item.name}`);
  return changes;
}

/** Compares menu content, ignoring the fetch timestamp. */
export function sameMenu(a: Menu | undefined, b: Menu): boolean {
  if (!a) return false;
  return (
    JSON.stringify(a.categories) === JSON.stringify(b.categories) &&
    a.dinnerAvailable === b.dinnerAvailable &&
    JSON.stringify(a.closedDays) === JSON.stringify(b.closedDays) &&
    a.lastPickup === b.lastPickup
  );
}
