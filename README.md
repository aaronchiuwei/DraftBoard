# Draft Room

An offline-first draft tracker for a live, in-person PPR fantasy football draft.

Open it on your phone, tap names as they come off the board, and it keeps the picks, the board, and every roster in sync. It works with no connection and needs no account.

Built for a specific league: **1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 DEF, 1 K**, snake order.

Preact + TypeScript, built with Vite, deployed as a static site on Vercel.

---

## Running it

```bash
npm install
npm run dev        # dev server with hot reload
npm test           # unit and integration tests
npm run build      # typecheck, then build to dist/
npm run preview    # serve the built output
npm run depth      # re-pull every team's depth chart from ESPN
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build rather than shipping.

---

## Getting it on your phone

1. Open the deployed URL on your phone.
2. **iPhone:** Share → Add to Home Screen. **Android:** Chrome menu → Add to Home screen.
3. Open it once from the home screen icon before draft day, to confirm it loads and to run through setup.

Step 3 matters for two reasons. Draft rooms have bad signal, and you want to find out about a problem on Thursday rather than on the clock. It also primes the offline cache and gets the draft an installed-app storage bucket, which browsers do not clear out from under you.

---

## Architecture

The app is layered so that the parts worth trusting can be tested without a browser, and so a new feature lands in one place rather than seven.

```
src/
  types.ts             shared model: Player, RankSource, LeagueSettings, DraftState
  data/
    players.2026.json  the player pool, one record per player
    depth.2026.json    every team's ESPN depth chart, refreshed by a script
    pool.ts            validates the JSON at boot, merges imported ranks
    depth.ts           validates the charts, ties each name to a pool player
    sources.ts         built-in rank source registry
    import.ts          parses and name-matches a pasted ranking
  domain/              pure functions, no DOM, no store
    draft.ts           snake order, pick labels, whose turn is next
    roster.ts          lineup slotting, needs, roster config
    rankings.ts        consensus, spread, rail geometry
    analytics.ts       tiers, positional runs, pick value, survival odds
  state/
    store.ts           minimal subscribe/notify store plus a Preact hook
    app.ts             the store instance and every action
    selectors.ts       derived reads: visible players, the queue, active sources
    persistence.ts     localStorage, schema versioning, v1 and v2 migration
  components/          Clock, Tabs, Controls, PlayerRow, Rail, StarButton, PlayerSheet
  views/               Players, Queue, Compare, Board, Teams, Depth, Setup, SourcesPanel
scripts/
  fetch-depth.mjs      rebuilds depth.2026.json from ESPN
```

Three decisions carry most of the weight.

**Rank sources are data, not structure.** A player has a `ranks` map keyed by source id, and sources come from a registry. Nothing outside `data/sources.ts` knows that NFFC or ESPN exist. This is what makes importing a new ranking a normal operation instead of a schema change, and it is why a newly imported source shows up automatically as a sort chip, a compare column, a rail dot, and a row in the player sheet. Consensus is computed from whichever sources are currently active rather than stored, so muting one recomputes everything downstream.

**Domain logic is pure and has no idea the DOM exists.** Snake order, lineup slotting, and tiering take plain data and return plain data. They are the parts where a bug would quietly cost you a pick, and they are tested directly.

**Views render from state; nothing writes to the DOM by hand.** The previous version rebuilt every view as an HTML string on each interaction, which meant the search box needed code to restore focus and caret position after each keystroke, and the board had to re-scroll itself. Those workarounds are gone.

---

## Drafting

Tap a player → a sheet shows every source's rank, the odds he lasts to your next pick, and who's on the clock → **Draft**.

- The top strip shows pick number, team on the clock, and what that team still needs.
- **Undo** removes the most recent pick.
- Tapping a drafted player offers **Put back**, which pulls him out of the middle of the draft without undoing everything after him.
- **Reset draft**, at the bottom of Setup, wipes every pick and takes two taps. Teams, names, draft slot, and imported rankings all survive it, so you can run a mock and then start the real thing.

---

## The tabs

**Players** — the main list, sorted by any source or by AVG. Filter by position, including a FLEX chip for RB + WR + TE. Within a single position the list is split into tiers.

**Queue** — the players you want, in your order. See below.

**Compare** — every source side by side. Green marks the source highest on a player, red the lowest, and Gap is the distance between them. Sort by disagreement or overall.

**Board** — the full snake grid, your team in amber, auto-scrolled to the current pick. Picks that landed well off consensus are marked green or red.

**Teams** — any team's roster slotted into the starting lineup, bench below.

**Depth** — ESPN's depth chart for all 32 NFL teams. See below.

**Setup** — league settings, ranking sources, and reset.

### Reading the rail

Every player row ends with one dot per source on a short axis. Centre is that player's consensus. **Left of centre means that source is higher on him.** A tight cluster is agreement; a spread-out rail is a fight. It's there so you can spot a contested player while scrolling.

---

## The queue and the star

Two ways to mark a player, for two different purposes.

**The queue is a plan.** Tap a player → **Add to queue**. He goes on the end, and the Queue tab reorders with the arrows. The row in the players list picks up a `Q3` chip so you can see where he sits without leaving the tab, and the clock strip carries a chip for the highest queued player still on the board — tap it to go straight to his sheet.

A player who gets drafted is **left in the queue rather than pulled out of it**, struck through and stamped with the pick he went at. Auto-removing would mean a mis-tap that you then put back also costs you the ordering you built. **Clear N gone** drops them once you're sure, and **Clear all** empties the queue.

The queue survives **Reset draft**, like imported rankings do. Running a mock shouldn't cost you your prep.

**The star is a highlight.** The ☆ at the right of a row in Players or Depth toggles it in one tap, and the player sheet has the same control. A flagged player gets an amber left edge and a tinted row everywhere he appears, including the queue, so a name you're watching is findable while scrolling past sixty rows. There's no ordering to it and it means whatever you want it to mean.

Both are per-device, saved with everything else, and independent of each other.

---

## Depth charts

The **Depth** tab has ESPN's chart for all 32 teams: quarterbacks, backs, receivers, tight ends, and the kicker, in ESPN's order, with jersey numbers and injury tags (`Q`, `OUT`, `IR`, `PS`).

Each name is matched against the player pool, so a charted player carries his rank under whichever source you're reading, strikes through once he's drafted, and opens the same sheet as anywhere else — you can draft straight off a chart. Names the pool doesn't carry (most of a 90-man roster) stay listed in grey, since the point of a depth chart is seeing who is behind whom.

Matching is by name and deliberately **not** gated on team, because the chart is fresher than the pool: a back ESPN lists in Kansas City may still be filed under Seattle here, and dropping him would hide the most interesting row on the page. The team only breaks a tie between two men with the same name.

### Refreshing them

Charts are **baked into the bundle**, not fetched at runtime, for the same reason the player pool is: the one moment you want this data is the moment you can't rely on the network. ESPN's roster endpoint also sends no CORS header, so a browser couldn't resolve athlete names on its own even with a connection.

```bash
npm run depth              # current season
npm run depth -- --season 2027
```

Two requests per team — the chart gives an ordered list of athlete ids, the roster turns those into names — then it writes `src/data/depth.2026.json` and prints a per-team count. Commit the result. The tab shows the pull date under the team name, because **a depth chart from three weeks ago is a guess**. Re-run it the morning of the draft.

---

## Analytics

All of it is derived at render time from the picks and the active sources.

| Signal | Where | What it does |
|---|---|---|
| Tiers | Players tab | Groups a position by gaps between consecutive ranks, so a cliff starts a new tier and five interchangeable backs stay in one. |
| Positional runs | Clock strip | Flags a position taken well above its own rate over the last 12 picks. |
| Picks until your turn | Clock strip | Counts picks between now and your next selection. |
| Survival odds | Player sheet | Rough chance he lasts to your next pick, from how many undrafted players the field ranks ahead of him, widened when sources disagree about him. |
| Pick value | Board | Marks picks that landed well past or well before consensus. |

Survival odds are an estimate from ADP, not a forecast. Treat a 60% as "probably, but don't bet the roster on it."

---

## Importing a ranking

Setup → Rankings → paste and name it. It becomes a first-class source: sortable, comparable, and counted in consensus.

Accepted formats, detected automatically:

```
Jahmyr Gibbs              # bare list, line order is the ranking
1. Jahmyr Gibbs           # numbered list
1,Jahmyr Gibbs            # CSV, no header
rank,player,pos,team      # CSV with a header, any column order
[{"name":"...","rank":1}] # JSON
```

Names are matched with punctuation, accents, and generational suffixes folded, so `A.J. Brown`, `AJ Brown`, and `Marvin Harrison Jr.` all land correctly. Defenses match as a full name, nickname, or abbreviation (`Houston Texans`, `Texans D/ST`, `HOU DST`). Anything that can't be matched is listed back to you rather than silently dropped, and an ambiguous surname is refused unless the import supplies a position or team to break the tie.

**Mute** drops a source from consensus, the rail, and the compare table without deleting it.

---

## The data

300 players. NFFC, ESPN, and Yahoo ranks come from a cross-platform ADP table, August 2026; the Big Board is a 150-player PPR board. AVG is the mean of whichever active sources rank a player, computed at runtime.

To refresh the pool, edit `src/data/players.2026.json` or add a new file alongside it. Records are `{id, name, team, pos, ranks}`, where `ranks` maps source id to rank and omits sources that don't rank him. Malformed records throw at boot rather than showing up as a blank cell mid-draft.

### Scoring formats are not identical

The most important caveat in the project:

| Source | Format |
|---|---|
| NFFC | Full PPR, 6-point passing TDs |
| ESPN | Full PPR |
| Yahoo | **Half PPR** |
| Big Board | Full PPR |

Yahoo publishes no full-PPR ADP, so part of every Yahoo gap is format rather than opinion: it reads high on low-reception backs and low on volume receivers and tight ends. NFFC embeds kickers and defenses in its overall list, so below roughly pick 140 a small NFFC gap is an artifact. ESPN ranks kickers and defenses far higher than NFFC does, which is genuine and is why K and DEF dominate the disagreement sort unless you filter by position.

### Rank capping in Compare

A player one source ranks 465th isn't "ranked 465," he's off the board. Compare caps every rank at the draft's horizon (last pick + 30) before computing the gap, so the sort surfaces real draft-day disagreement instead of measuring how long each list happens to be.

---

## Saving and storage

Picks save after every action, debounced, and flush immediately when the app is backgrounded or closed.

Everything lives in `localStorage` on the device you're drafting on. There is no account and no backend to send anything to. The flip side is that the draft is **per device and per browser** — your phone and your laptop each keep their own.

On first load the app calls `navigator.storage.persist()`. Without it, browsers may evict a site's `localStorage` under storage pressure, and Safari clears it after seven days of not visiting. A granted persist exempts the origin from both, and installing to the home screen is what gets it granted.

Saved state is schema-versioned, and the queue, the flags, and your last depth-chart team are saved along with the picks. A draft saved by the original single-file version, or by any version before the queue existed, is migrated on first load rather than lost, and there are tests covering both.

### Offline

`vite-plugin-pwa` precaches the whole app, so opening it with no connection works and costs no network round trip. A new deploy is fetched in the background and takes effect the next time you open it.

---

## Testing

84 tests, no browser required.

- `src/domain/*.test.ts` — snake order, lineup slotting, consensus, spread, rail geometry.
- `src/data/import.test.ts` — ranking parsers and name matching, including ambiguity and duplicates.
- `src/App.test.tsx` — the app rendered into a real DOM and driven through drafting, undo, put-back, search, every tab, queueing and reordering, flagging, reading and drafting off a depth chart, importing a source, muting a source, reset, reload persistence, and the v1 and v2 migrations.

---

## Known limitations

- **No kickers or defenses on the Big Board**, so sorting by BIG in those positions returns nothing. Use another source.
- **Ranks are a snapshot.** Pulled August 2026. Import a fresher ADP if something moved.
- **Depth charts are a snapshot too**, and a faster-moving one. Run `npm run depth` and redeploy before draft day. There is no in-app refresh, because there is no backend to proxy ESPN through.
- **Depth charts cover the offense and the kicker only.** Offensive line, defense, and punt returners are dropped; nothing in this draft turns on the left guard.
- **The queue has no drag handle.** Reordering is the arrows, which is slower for a long list but does not misfire on a phone mid-draft.
- **No trades, keepers, or auction.** Straight snake only.
- **One draft at a time**, on **one device**. The board is not shared or synced.
- **The roster shape is configurable in the data model but not yet in the UI.** `LeagueSettings.roster` is read everywhere it matters; Setup just doesn't expose an editor for it yet.

---

## Deploying

Static site. Vercel detects Vite and builds with `npm run build` into `dist`. `vercel.json` sends `index.html` and `sw.js` with a revalidating cache header so a push reaches devices instead of sitting behind the CDN; the service worker handles offline caching.

First-time setup: import the repo at [vercel.com/new](https://vercel.com/new). Framework Preset should detect as **Vite** — leave the build and output settings alone. After that, every push to `main` deploys, and pull requests get preview URLs.
