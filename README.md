# Draft Room

An offline-first draft tracker for a live, in-person PPR fantasy football draft.

One HTML file. No install, no build step, no server, no accounts. Open it on your phone, tap names as they come off the board, and it keeps the picks, the board, and every roster in sync.

Built for a specific league: **1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 DEF, 1 K**, snake order.

Deployed as a static site on Vercel. It can also still be opened straight off disk as a local file.

---

## Files

| File | What it is |
|---|---|
| `draft-room.html` | The entire app. Player data is embedded — this is the only file you need to run it locally. |
| `sw.js` | Service worker. Caches the app so it opens with no connection. |
| `manifest.webmanifest` | Makes Add to Home Screen open it fullscreen with an icon. |
| `icon.svg` | Home screen icon. |
| `vercel.json` | Serves `draft-room.html` at `/` and keeps the app shell off the CDN cache. |
| `README.md` | This document. |

---

## Getting it on your phone

1. Open the deployed URL on your phone.
2. **iPhone:** Share → Add to Home Screen. **Android:** Chrome menu → Add to Home screen.
3. Open it once from the home screen icon before draft day, to confirm it loads and to run through setup.

Step 3 matters for two reasons. Draft rooms have bad signal, and you want to find out about a problem on Thursday rather than on the clock. It also primes the offline cache and gets the draft an installed-app storage bucket, which browsers do not clear out from under you.

You can still skip all of this and open `draft-room.html` directly from disk. The offline cache is the only thing that doesn't apply.

---

## Setup

The Setup tab runs first and nothing else works until you save it.

- **Teams** — 4 to 16
- **Rounds** — 10 to 25
- **Your draft slot** — highlights your team in amber across the app
- **Team names** — edit all of them; they show up on the board and the teams tab

The roster shape is fixed at 1 QB / 2 RB / 2 WR / 1 TE / 2 FLEX / 1 DEF / 1 K. FLEX takes RB, WR, or TE.

You can come back to Setup mid-draft to fix a team name. Changing the *team count* mid-draft will re-assign existing picks to different teams, since snake order depends on it — the tab warns you when picks already exist.

---

## Drafting

Tap a player → a sheet shows his four ranks and who's on the clock → **Draft**. He's assigned to that team and the pick advances.

- The top strip always shows pick number, team on the clock, and what that team still needs.
- **Undo** removes the most recent pick.
- Tapping an already-drafted player shows where he went and offers **Put back** — use this to pull a player out of the middle of the draft without undoing everything after him.
- **Reset draft**, at the bottom of the Setup tab, wipes every pick. It takes two taps: the first arms it and it disarms itself after four seconds if you don't follow through. Team count, names, and your draft slot survive a reset, so you can run a mock and then start the real thing without re-entering the league.

---

## The tabs

**Players** — the main list. Sort by NFFC, BIG (your Big Board), ESPN, YAHOO, or AVG (mean of available ranks). Filter by position, including a FLEX chip that shows RB + WR + TE together. Search by name or team. The "Hiding taken" toggle switches between hiding drafted players and showing them greyed and struck through.

**Compare** — all four ranks side by side in one table. Green marks the source highest on a player, red the lowest, and the Gap column is the distance between them. Default sort is most disagreement first; switch to Overall for straight rank order.

**Board** — the full snake grid. Rounds down the side, teams across the top, your team in amber. Scrolls to the current pick automatically.

**Teams** — any team's roster slotted into the starting lineup, with bench below. Shows which slots are still open and what pick each player came at.

### Reading the rail

Every player row ends with four dots on a short horizontal axis:

| Dot | Source |
|---|---|
| Amber | NFFC |
| White | Big Board |
| Blue | ESPN |
| Purple | Yahoo |

Center line is that player's consensus. **Left of center = that source is higher on him. Right = lower.** A tight cluster means the sources agree; a spread-out rail means they don't. It's there so you can spot a contested player while scrolling, without opening anything.

---

## The data

300 players, merged from two places:

- **NFFC, ESPN, and Yahoo ranks** — a cross-platform ADP table, August 2026.
- **Big Board** — your own 150-player PPR board, transcribed from the image you provided. All 150 matched to the ranking data with no leftovers.

`cons` (shown as AVG) is the mean of whichever ranks a player actually has. Players missing from a source show `–` and are excluded when you sort by that source.

### Scoring formats are not identical

This is the most important caveat in the project, and it's worth re-reading before you trust a gap:

| Source | Format |
|---|---|
| NFFC | Full PPR, 6-point passing TDs, high-stakes entry fee |
| ESPN | Full PPR (platform default) |
| Yahoo | **Half PPR** (platform default) |
| Big Board | Full PPR |

Yahoo does not publish a full-PPR ADP — there's one Yahoo number and it comes from drafts running Yahoo's half-PPR default. So part of every Yahoo gap is format, not opinion. In practice: Yahoo will read high on low-reception running backs and low on reception-volume receivers and tight ends relative to the other three. Adjust for that before calling something a disagreement.

Two more differences worth knowing. NFFC ranks embed kickers and defenses in the overall list, so below roughly pick 140 a small NFFC-vs-others gap is an artifact rather than a real split. And ESPN's default list ranks kickers and defenses far higher than NFFC does — that's genuine, not a bug, and it's why K and DEF dominate the Compare tab's disagreement sort unless you filter by position.

### Rank capping in Compare

A player one source ranks 465th isn't "ranked 465" in any meaningful sense — he's off the board. Compare caps every rank at your draft's horizon (last pick + 30) before computing the gap, so the sort surfaces real draft-day disagreement instead of measuring how long each list happens to be.

---

## Saving and storage

Picks save after every action. Locking your phone, switching apps, or an accidental reload won't lose the draft.

Everything lives in `localStorage` on the device you're drafting on. There is no account, no sign-in, and nothing is sent anywhere — the deployed site is static files and has no backend to send it to. The flip side is that the draft is **per device and per browser**. Your phone and your laptop each keep their own separate draft, and clearing site data clears it.

On first load the app calls `navigator.storage.persist()`. Without it, browsers are free to evict a website's `localStorage` when the device is short on space, and Safari additionally clears it after seven days of not visiting the site. A granted persist exempts the origin from both. Chrome and Firefox grant it silently once the app is installed to the home screen; Safari grants it on Add to Home Screen. This is the reason step 3 above is worth doing.

Storage still falls back through three layers if something is unavailable: the artifact storage API if the page is running inside one, then `localStorage`, then plain memory. Memory is the last resort and does not survive a reload — it only happens in a browser with storage fully disabled.

### Offline

`sw.js` caches the app on first visit and serves from that cache first, so opening the site with no connection works and costs no network round trip. A new deploy is fetched in the background and takes effect the next time you open the app.

---

## Known limitations

- **No kickers or defenses on the Big Board.** Your board doesn't include them, so sorting by BIG in those positions returns nothing. The app says so and tells you to switch sources. Use NFFC, ESPN, Yahoo, or AVG for K and DEF.
- **Ranks are a snapshot.** They were pulled in August 2026 and don't update. Injury news after that date isn't reflected — check anything that matters before you take him.
- **No trades, keepers, or auction.** Straight snake only.
- **One draft at a time.** Starting a new one means resetting the current one.
- **One device.** The draft is not shared or synced. Whoever is tapping picks needs to be the one holding the phone.
- **No projections or tiers.** This tracks a draft; it doesn't tell you who's good.

---

## Technical notes

Vanilla HTML, CSS, and JavaScript in a single file, roughly 67 KB with the player data embedded. No frameworks, no CDN, no webfonts — system font stack throughout, deliberately, so nothing depends on a connection. Dark palette with per-position color coding, 44px-minimum tap targets, bottom navigation in the thumb zone, and `prefers-reduced-motion` respected.

### Deploying

Static site, no build step. Vercel serves the repo root as-is and `vercel.json` rewrites `/` to `draft-room.html`. `sw.js` and `draft-room.html` are sent with `Cache-Control: no-cache` so a push reaches devices instead of sitting behind the CDN; the service worker handles the actual offline caching. Pushing to `main` deploys.

To change the player data, edit the embedded `PLAYERS` array near the top of the `<script>` block. Each entry is `{id, name, team, pos, espn, nffc, yahoo, bb, cons}`, where `null` means that source doesn't rank him.
