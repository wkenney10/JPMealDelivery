# JP Meal Delivery

Customer-facing MVP for a neighborhood dinner delivery service in Jamaica Plain (Boston).

**How the business works:** customers order by 4 PM for delivery between 5 and 9 PM. We place a normal
takeout order on each restaurant's own online-ordering site, a driver picks it up, and we deliver it.
Restaurants pay nothing. Customers pay what the takeout order costs: menu prices, 7% MA meals tax, and any
fee the restaurant's ordering site adds. On top of that is a flat **$5 delivery fee per restaurant**
($10 for two restaurants, $15 for three, …).

## What's here

| Area | Where |
| --- | --- |
| Restaurant list, menus, cart, checkout, order confirmation | `src/app` (`/`, `/r/[slug]`, `/cart`, `/checkout`, `/order/[code]`) |
| Operator pages (orders by date and slot, menu status) | `/admin`, `/admin/menus` (password: `ADMIN_PASSWORD`) |
| Pricing, fees and tax | `src/lib/pricing.ts`, `src/lib/config.ts` |
| Ordering rules (4 PM cutoff, 30-min slots 5–9 PM, 6 days ahead, ZIP 02130 only) | `src/lib/schedule.ts`, `src/lib/address.ts`, `src/lib/config.ts` |
| Restaurant registry | `data/restaurants.json` |
| Scraped menus | `data/menus/<slug>.json` (generated) |
| Hand-maintained fallback menus | `data/menus-manual/<slug>.json` (see `_template.json`) |
| Menu scraper | `scraper/` (`npm run scrape`) |
| Daily menu refresh | `.github/workflows/refresh-menus.yml` |

No payment is collected yet. Orders are recorded and show up in `/admin` for the operator to place.

## Running locally

```bash
cp .env.example .env          # set ADMIN_PASSWORD
npm install
npm run db:push               # creates prisma/dev.db
npm run scrape                # fetches menus into data/menus/
npm run dev                   # http://localhost:3000
npm test
```

The scraper uses Playwright's Chromium for some platforms. After `npm install`, run
`npx playwright install chromium` once.

## Menus: scraping and refresh

Each restaurant in `data/restaurants.json` names the platform behind its own online ordering. The scraper
has an adapter for each one:

| Platform | How it's read | Status |
| --- | --- | --- |
| Slice | Menu state embedded in the page (plain HTTP) | Tested against live pages |
| Square Online | Public storefront JSON API, including modifier groups | Tested against live API |
| Clover Online Ordering | Server-rendered HTML | Tested against a live page (base prices only, no modifiers) |
| menu.app (Life Alive) | JSON API captured in a headless browser | Tested against live API (base prices only) |
| Toast | GraphQL responses captured in a real browser, parsed generically | **Not yet verified.** See below. |
| ChowNow | API responses captured in a real browser | **Not yet verified** |
| DoorDash Storefront (order.online) | Menu data embedded in the server-rendered page (Next.js flight payload) | Tested against live pages (base prices only) |

Toast, ChowNow and DoorDash Storefront sit behind Cloudflare bot protection, which blocked the
cloud environment this was built in. Those adapters capture the platform's own API traffic and use a
schema-agnostic extractor (`scraper/extract.ts`), so they don't depend on exact field names. Still, they
need a first run from a normal network, either GitHub Actions or a home computer, to confirm they work. When
a browser-based scrape runs, the raw API captures go to `SCRAPE_DEBUG_DIR`. CI uploads them as the
`scrape-debug` artifact, so the parsers can be tuned against real data.

**Refresh schedule:** the "Refresh menus" workflow runs every morning (9:20 AM Eastern) and on demand
(Actions → Refresh menus → Run workflow, optionally with specific slugs). It commits any changed menus plus
`data/scrape-report.json`. Merging or deploying that commit updates the live site. Safeguards:

- A failed scrape never deletes a menu. The previous menu stays live and the failure shows in `/admin/menus`.
- A scrape that suddenly returns fewer than 40% of the previous item count is treated as a broken parse
  and rejected.
- Menus are only rewritten when content changes, so the git history of `data/menus/` is a price-change log.
- Restaurants whose ordering site shows they aren't open at dinner (Slice exposes hours) are hidden.

**Toast, ChowNow and DoorDash Storefront from your own computer:** these platforms block cloud servers,
GitHub's included, so they're refreshed weekly with `npm run scrape:local`. It runs in a visible
Chrome window on a home connection and waits for you to click through any bot check. Step-by-step
instructions: [docs/local-menu-refresh.md](docs/local-menu-refresh.md).

**What customers see:** every menu passes through `src/lib/menu-filter.ts` when it loads. It removes
alcohol (delivering it needs a Massachusetts license), catering, breakfast/brunch, and retail sections,
plus alcoholic items inside drink sections. It also drops repeated menu copies priced above the
restaurant's main menu (Toast restaurants often publish a marked-up delivery-app menu), and merges
duplicate sections. The scraped files keep everything, so adjusting the rules never needs a re-scrape.

**Manual fallback:** if a restaurant can't be scraped, copy `data/menus-manual/_template.json` to
`data/menus-manual/<slug>.json` and fill it in (prices in cents). A successful scrape always takes
precedence. Restaurants with no menu at all are listed as "Coming soon" and can't be ordered from.

**Current state (2026-10-05):** 16 restaurants have live menus: 11 on Slice, 3 on DoorDash Storefront
(Mario's, Noodle Barn, Top Mix), plus Achilito's (Square), Don Tequeño (Clover) and Life Alive
(menu.app). Mike & Patty's scraped fine but is hidden because it doesn't serve dinner. The 14 Toast and
ChowNow restaurants and bb.q Chicken block cloud servers, so they show as "Coming soon" until the first
local refresh (`npm run scrape:local`, see below).

## Design and restaurant logos

The look is a printed menu: Libre Caslon (via Google Fonts) for type, newsprint paper, ink, one brick-red
accent, hairline and double rules, dotted price leaders, and square corners. Design tokens live in
`src/app/globals.css`.

Restaurant logos are printed in the page's ink so the whole list feels like one menu:

- `npm run logos` finds each restaurant's logo (from Slice/Clover, or the restaurant's website header)
  and converts it to a one-colour mark in `public/logos/<slug>.png`, indexed in `data/logos.json`.
  Backgrounds are removed. Solid badges become stamps with knocked-out lettering. Counters inside
  letters stay open.
- The app uses each file as a mask (`src/components/restaurant-mark.tsx`), so the logo can be tinted
  any colour (ink normally, brick red on hover).
- Restaurants without a usable logo get a typographic house mark: the name in capitals inside a
  double rule.
- Fix a bad conversion with a `logo` block on the restaurant in `data/restaurants.json`, then rerun
  `npm run logos -- <slug>`: `url` (use a specific image), `threshold` (0–1; higher drops more of a
  busy background), `invert` (for white-on-transparent logos), `mode: "original"` (keep the
  logo's own colours), or `disabled` (always use the house mark). `/admin/menus` shows every mark
  for review.

Before launch, it's worth asking each restaurant if they're happy for their logo to appear (most
will be, since it sends them orders), and swapping in a clean vector logo where they have one.

## Restaurant coverage

`data/restaurants.json` lists 32 JP restaurants (all ZIP 02130) where I found **direct web ordering
for takeout**. I compiled it from OpenStreetMap, the JP Centre/South Main Streets directory, local
news (openings and closings through 2026), and by checking each restaurant's website for ordering links.

Things to verify before launch:

- **Restaurants I couldn't find direct web ordering for:** Blue Nile, Bukhara, Young Kong, JP Kitchen,
  Momo Masala, El Oriental de Cuba, Pikalo, Galway House, Jeanie Johnston, Across the Border, Ethiopian
  Cafe, Flavor Boom, Purple Cactus, Pete's A Pizza, Nicole's Pizza, Tikki Masala, New Oriental House,
  Chilacates (Centre St), and Acapulco (chain Olo site, JP location not found). Some only take
  phone orders or use Grubhub/Uber Eats, and some websites blocked automated checks. Add any that do
  have direct ordering to the registry.
- **Daytime-only spots:** Mike & Patty's and Evergreen Eatery may not serve dinner. The scraper
  hides Slice restaurants automatically when their pickup hours don't cover dinner. Set `active: false`
  for others as needed.
- **Platform service fees:** `fees.serviceFeePercent` / `fees.serviceFeeFlat` default to zero for every
  restaurant. Some ordering sites add a fee to pickup orders, so check one real checkout per restaurant,
  set the fee, and set `feesVerified: true`. `/admin/menus` flags unverified restaurants.
- **Hours:** `closedDays` (0 = Sunday) and `lastPickup` (latest slot start, "HH:MM") control which
  delivery slots a restaurant is offered in. Fill these in per restaurant.
- **Options:** Slice sizes and Square modifiers are captured. Clover and menu.app items only have base
  prices, so customers can leave special instructions but paid add-ons aren't modeled for those yet.

## Deploying

The app is a standard Next.js 15 app. For production:

1. Switch `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL` to a hosted
   Postgres database (Neon, Supabase, Render, …). SQLite is for local development only.
2. Set `ADMIN_PASSWORD`.
3. Deploy (Vercel, Render, etc.). `data/` is bundled with the app, so a menu-refresh commit triggers a redeploy.
