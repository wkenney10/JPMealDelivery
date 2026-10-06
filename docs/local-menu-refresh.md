# Refreshing Toast, ChowNow and DoorDash menus from your Mac

The daily GitHub Action refreshes menus from Slice, Square, Clover and Life Alive automatically. The
restaurants on **Toast, ChowNow and DoorDash Storefront** block requests from cloud servers, so those
menus are refreshed from your own computer instead. Doing this **once a week** is plenty, since these
menus change rarely, and the daily Action never deletes a menu you fetched locally.

## One-time setup (about 10 minutes)

1. **Install Node.js 22** from <https://nodejs.org> (the "LTS" download), or with Homebrew:
   `brew install node@22`.
2. **Have Google Chrome installed.** The scraper drives your real Chrome, which passes bot checks
   far more reliably than a test browser.
3. **Get the code.** Open Terminal and run:

   ```bash
   cd ~
   git clone https://github.com/wkenney10/JPMealDelivery.git
   cd JPMealDelivery
   git checkout claude/jp-food-delivery-mvp-4to4om
   npm install
   ```

   If `git clone` asks you to sign in, the easiest route is [GitHub Desktop](https://desktop.github.com):
   sign in, then **File → Clone repository → wkenney10/JPMealDelivery**, then switch to the
   `claude/jp-food-delivery-mvp-4to4om` branch. Run `npm install` in Terminal from that folder.

## Each refresh (about 10–20 minutes, mostly waiting)

Run it **in the evening, after 5 PM**: some Toast restaurants (Tres Gatos, Brassica) only show their
menu while they are open. Use your normal home internet, not a VPN.

```bash
cd ~/JPMealDelivery
git pull
npm run scrape:local
```

- A Chrome window opens and visits each restaurant's ordering page in turn. Leave it alone.
- If a page shows **"Verify you are human"** with a checkbox, click the checkbox. The scraper waits
  up to 2 minutes per page for you, then moves on.
- When it finishes, Terminal prints a summary: ✅ for updated menus (with price changes listed),
  ❌ for any it couldn't read.

Then save and publish the new menus:

```bash
git add data
git commit -m "Local menu refresh"
git push
```

(Or in GitHub Desktop: write a summary, click **Commit**, then **Push origin**.)

## Useful variations

```bash
npm run scrape:local -- tonino tres-gatos   # just these restaurants (slugs from data/restaurants.json)
npm run scrape -- --local                   # every restaurant, all platforms, in visible Chrome
```

## If something goes wrong

- **❌ "Blocked by bot protection"** for every restaurant: try again later, or from a different
  network. Click the checkbox if it appears.
- **❌ "No menu found"** for one restaurant: the ordering site changed or the restaurant uses a
  different link now. Run `SCRAPE_DEBUG_DIR=debug npm run scrape:local -- <slug>` and share the
  `debug/<slug>` folder so the parser can be adjusted.
- The admin page **/admin/menus** shows when each menu was last verified and flags stale ones.
