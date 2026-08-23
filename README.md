# Draft Room

An offline-first draft tracker for a live, in-person PPR fantasy football draft.

Open it on your phone, tap names as they come off the board, and it keeps the picks, the board, and every roster in sync. It works with no connection once you are signed in. An account is required; with a configured project it also carries the same draft to a second device.

Built for a specific league: **1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 DEF, 1 K**, snake order.

Preact + TypeScript, built with Vite, deployed as a static site on Vercel.

**Live site:** [fantasy-football-nine-zeta.vercel.app](https://fantasy-football-nine-zeta.vercel.app/)

---

## Running it

```bash
npm install
npm run dev        # dev server with hot reload
npm test           # unit and integration tests
npm run build      # typecheck, then build to dist/
npm run preview    # serve the built output
npm run depth      # re-pull every team's depth chart from ESPN
npm run injuries   # re-pull the league injury report from ESPN
npm run stats      # re-pull last season's stats and this season's projections
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build rather than shipping.

---

## Getting it on your phone

1. Open [fantasy-football-nine-zeta.vercel.app](https://fantasy-football-nine-zeta.vercel.app/) on your phone.
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
    stats.2026.json    last season played and this season projected, per player
    pool.ts            validates the JSON at boot, merges imported ranks
    depth.ts           validates the charts, ties each name to a pool player
    stats.ts           picks the stat lines worth showing for each position
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
    persistence.ts     localStorage, per-account slots, schema versioning
    supabase.ts        lazily loaded client, absent unless configured
    auth.ts            sessions, and merging a device against the cloud
    sync.ts            reads and writes the one row an account owns
  components/          Clock, Tabs, Controls, PlayerRow, Rail, StarButton,
                       PlayerSheet, Headshot, StatTable
  views/               Players, Queue, Compare, Board, Teams, Depth, Setup,
                       SourcesPanel, Auth, AccountPanel
scripts/
  fetch-depth.mjs      rebuilds depth.2026.json from ESPN
  fetch-stats.mjs      rebuilds stats.2026.json from Sleeper
```

Three decisions carry most of the weight.

**Rank sources are data, not structure.** A player has a `ranks` map keyed by source id, and sources come from a registry. Nothing outside `data/sources.ts` knows that NFFC or ESPN exist. This is what makes importing a new ranking a normal operation instead of a schema change, and it is why a newly imported source shows up automatically as a sort chip, a compare column, a rail dot, and a row in the player sheet. Consensus is computed from whichever sources are currently active rather than stored, so muting one recomputes everything downstream.

**Domain logic is pure and has no idea the DOM exists.** Snake order, lineup slotting, and tiering take plain data and return plain data. They are the parts where a bug would quietly cost you a pick, and they are tested directly.

**Views render from state; nothing writes to the DOM by hand.** The previous version rebuilt every view as an HTML string on each interaction, which meant the search box needed code to restore focus and caret position after each keystroke, and the board had to re-scroll itself. Those workarounds are gone.

---

## Drafting

Tap a player → a sheet shows his headshot, every source's rank, last season against this season's projection, the odds he lasts to your next pick, and who's on the clock → **Draft**.

- The top strip shows pick number, team on the clock, and what that team still needs.
- **When it's your turn the whole strip goes red and pulses**, and the chip under it reads `★ You're up — pick now`. Missing your turn is the one mistake in a live draft you can't undo, so it is the one thing the app is loud about. Under `prefers-reduced-motion` the colour stays and the pulsing stops.
- **Undo** removes the most recent pick.
- Tapping a drafted player offers **Put back**, which pulls him out of the middle of the draft without undoing everything after him.
- **Reset draft**, at the bottom of Setup, wipes every pick and takes two taps. Teams, names, draft slot, and imported rankings all survive it, so you can run a mock and then start the real thing.

---

## The tabs

**Players** — the main list, sorted by any source or by AVG. Filter by position, including a FLEX chip for RB + WR + TE. Within a single position the list is split into tiers. With no position filter, a green line marks each of your upcoming picks. See below.

**Queue** — the players you want, in your order. See below.

**Compare** — every source side by side. Green marks the source highest on a player, red the lowest, and Gap is the distance between them. Sort by disagreement or overall.

**Board** — the full snake grid, your team in amber, auto-scrolled to the current pick. Picks that landed well off consensus are marked green or red.

**Teams** — any team's roster slotted into the starting lineup, bench below.

**Depth** — ESPN's depth chart for all 32 NFL teams. See below.

**Setup** — league settings, ranking sources, and reset.

### Your pick line

On the Players tab, a green line marks where each of your own picks falls in the list. Drafting eighth of twelve, the first line sits between the 7th and 8th player and reads `Round 1 · Pick 8`: seven players go before you, so everything above the line is expected to be gone. The next line is `Round 2 · Pick 5`, because the snake turns round.

The line is a **depth into the board, not a rank**. Every pick between now and yours costs one player, so the gap closes by one each time a name comes off — three picks in, the first line sits four players down. Rows for players already taken are stepped over rather than counted, so turning off **Hiding taken** moves nothing. Your soonest pick is drawn brightest; the ones after it are dimmed so a long list reads as a sequence rather than a row of alarms. On your own clock the line goes to the top and reads `On the clock now`.

The lines only appear with the position filter on **ALL** and the search box empty. Under a filter the count would be a lie — seven picks are not seven running backs — and the honest thing is to show nothing rather than a number that reads as precise.

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

## Injury reports

Every player in the pool carries an injury tag when ESPN or Sleeper reports one: **Q**, **D**, **OUT**, **PUP**, **IR**, and the rest. The tag sits beside his name in Players, Queue, and Depth; hover to see the injury, status, how long he's been out, and when ESPN expects him back.

**Two sources, one tag.** ESPN supplies return dates; Sleeper is cross-referenced for fantasy-specific designations (PUP vs Out) and catches pool players ESPN omits. When the sources disagree, the tag turns amber and the tooltip shows both — e.g. ESPN says Out but Sleeper says PUP. Yahoo has no public injury API, so it isn't included.

ESPN's return date is often the **next game window** for Questionable tags (opening week for many players in August), not a full recovery timeline. A player listed Q with "Back in ~5 days" may still be a week-to-week concern — read the injury line and the "Out since" date together.

```bash
npm run injuries              # current season — ESPN + Sleeper
npm run injuries -- --season 2027
```

Two requests (ESPN injury report, Sleeper player directory), then it writes `src/data/injuries.2026.json`. Commit the result. Like depth charts, this is baked in at build time — run it the morning of the draft and redeploy.

---

## Stats and headshots

The player sheet carries a portrait and two columns: what he actually did last season, and what he's projected to do this one. Both come from Sleeper, matched to all 300 players in the pool.

Which lines show depends on the position, because a single shared table would be mostly blank whichever player you opened. A back gets carries and receiving work, since targets are what decide him in PPR; a quarterback gets passing and rushing; a kicker gets field goals; a defence gets sacks, takeaways, and points allowed. Rows both seasons leave empty are dropped, so a rookie shows a projection against a blank column instead of eight blank rows.

An untouched stat and a zero are not the same thing, and the table keeps them apart: `–` means the season has no number for him, which is why 36 players — the rookies — have no last-season column at all.

### Refreshing them

```bash
npm run stats              # current season
npm run stats -- --season 2027
```

Three requests: Sleeper's player directory, last season's stats, this season's projections. The pool has no external ids, so the script matches 300 names to Sleeper's directory on exact name, then on surname within a team and position, which is what catches a "Hollywood" listed as "Marquise". It prints anything it couldn't match rather than leaving a sheet quietly empty, and it is expected to match all 300. The result is about 50KB of JSON, 11KB over the wire.

**Headshots are the one thing left on the network.** They are around 100KB each and 300 of them would dwarf the app, so only the id is baked in and the image is fetched when the sheet opens. The service worker keeps the ones you've actually looked at, so a player reviewed on the sofa still has a face in the draft room. A portrait that can't load falls back to initials in the position colour, which is what a team defence gets too.

---

## Accounts and sync

**Required to open the app.** With no Supabase project set, accounts still work — email and password against a list stored on the device. With a project configured, the same sign-in also syncs your league, queue, flags, and picks to any device you use.

```bash
cp .env.example .env.local     # then fill in the two values
```

Run `supabase/schema.sql` once in the SQL editor. It creates one row per account and turns on row-level security — the anon key ships in the bundle, so those policies are the only thing keeping one account's draft away from another's.

### Sign-in is the gate

You cannot draft without an account. A remembered session opens straight into your draft offline; the cloud is confirmed in the background when configured. Signing out returns you to the sign-in screen.

### Which copy wins

Local storage stays the source of truth during a draft; the cloud is a sync target, pushed on a 2.5-second debounce so a run of picks is one request.

On sign-in the device and the cloud are reconciled by which was written last, and every payload carries the timestamp that decides it. Nothing is ever half-applied: one copy wins whole. If the pull fails, pushing stays switched off until it succeeds, so a stale device can't overwrite a newer draft from another one — it retries when the connection returns. An account with nothing saved anywhere adopts whatever draft is already on the device.

Two accounts on one phone each get their own slot.

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

300 players. NFFC, ESPN, and Sleeper ranks come from each platform's ADP, August 23, 2026; Yahoo is the Yahoo analysts' consensus full-PPR board; the Big Board is a 150-player PPR board; Claude is a separate 262-player PPR board (blend of NFFC/Sleeper consensus plus a value model). AVG is the mean of whichever active sources rank a player, computed at runtime.

To refresh the pool, edit `src/data/players.2026.json` or add a new file alongside it. Records are `{id, name, team, pos, ranks}`, where `ranks` maps source id to rank and omits sources that don't rank him. Malformed records throw at boot rather than showing up as a blank cell mid-draft.

### Scoring formats are not identical

The most important caveat in the project:

| Source | Format |
|---|---|
| NFFC | Full PPR, 6-point passing TDs |
| ESPN | Full PPR |
| Yahoo | Full PPR |
| Sleeper | Full PPR |
| Big Board | Full PPR |
| Claude | Full PPR |

Yahoo is analyst consensus (Boone, Harmon, Norris, Pianowski, Smyth, Winks), not Yahoo ADP, so a Yahoo gap is opinion rather than format. Sleeper's default rooms are half-PPR; the Sleeper column is their PPR ADP, not a typical Sleeper room. NFFC embeds kickers and defenses in its overall list, so below roughly pick 140 a small NFFC gap is an artifact. ESPN ranks kickers and defenses far higher than NFFC does, which is genuine and is why K and DEF dominate the disagreement sort unless you filter by position.

### Rank capping in Compare

A player one source ranks 465th isn't "ranked 465," he's off the board. Compare caps every rank at the draft's horizon (last pick + 30) before computing the gap, so the sort surfaces real draft-day disagreement instead of measuring how long each list happens to be.

---

## Saving and storage

Picks save after every action, debounced, and flush immediately when the app is backgrounded or closed.

Everything lives in `localStorage` on the device you're drafting on, under one slot per account. Without an account there is no backend to send anything to, and the draft is **per device and per browser** — your phone and your laptop each keep their own. Signing in adds a cloud copy on top; it never becomes the thing the draft depends on.

On first load the app calls `navigator.storage.persist()`. Without it, browsers may evict a site's `localStorage` under storage pressure, and Safari clears it after seven days of not visiting. A granted persist exempts the origin from both, and installing to the home screen is what gets it granted.

Saved state is schema-versioned, and the queue, the flags, and your last depth-chart team are saved along with the picks. A draft saved by the original single-file version, or by any version before the queue existed, is migrated on first load rather than lost, and there are tests covering both.

### Offline

`vite-plugin-pwa` precaches the whole app, so opening it with no connection works and costs no network round trip. A new deploy is fetched in the background and takes effect the next time you open it.

Headshots are the one exception, fetched from Sleeper's CDN and kept in a runtime cache once seen. Everything a draft actually needs — players, ranks, depth charts, stats, projections — is in the bundle.

---

## Testing

117 tests, no browser required.

- `src/domain/*.test.ts` — snake order, lineup slotting, consensus, spread, rail geometry, and where each of your picks lands in the list.
- `src/data/import.test.ts` — ranking parsers and name matching, including ambiguity and duplicates.
- `src/state/persistence.test.ts` — the payload round trip, the write stamp that decides a device against the cloud, and keeping two accounts on one device apart.
- `src/App.test.tsx` — the app rendered into a real DOM and driven through drafting, undo, put-back, search, every tab, queueing and reordering, flagging, reading and drafting off a depth chart, importing a source, muting a source, reset, reload persistence, the v1 and v2 migrations, the pick lines under every filter, the stat panel per position, and a remembered account opening its own draft with no network.

---

## Known limitations

- **No kickers or defenses on the Big Board or Claude**, so sorting by BIG or CLAUDE in those positions returns nothing. Use another source.
- **Ranks are a snapshot.** Pulled August 23, 2026. Import a fresher ADP if something moved.
- **Depth charts are a snapshot too**, and a faster-moving one. Run `npm run depth` and redeploy before draft day. There is no in-app refresh, because there is nothing in the app proxying ESPN.
- **Injury reports are a snapshot too.** Run `npm run injuries` alongside `npm run depth` before draft day. They merge ESPN return dates with Sleeper status tags.
- **Projections are somebody else's opinion**, pulled once from Sleeper and baked in. They move through preseason; re-run `npm run stats` before draft day.
- **Headshots need a connection the first time.** Ones you haven't opened before will be initials in a dead room.
- **Depth charts cover the offense and the kicker only.** Offensive line, defense, and punt returners are dropped; nothing in this draft turns on the left guard.
- **The queue has no drag handle.** Reordering is the arrows, which is slower for a long list but does not misfire on a phone mid-draft.
- **No trades, keepers, or auction.** Straight snake only.
- **One draft at a time per account.** Signing in carries that draft between your own devices; it is not a shared board, and two people cannot draft into it at once.
- **The roster shape is configurable in the data model but not yet in the UI.** `LeagueSettings.roster` is read everywhere it matters; Setup just doesn't expose an editor for it yet.

---

## Deploying

Static site. Vercel detects Vite and builds with `npm run build` into `dist`. `vercel.json` sends `index.html` and `sw.js` with a revalidating cache header so a push reaches devices instead of sitting behind the CDN; the service worker handles offline caching.

First-time setup: import the repo at [vercel.com/new](https://vercel.com/new). Framework Preset should detect as **Vite** — leave the build and output settings alone. After that, every push to `main` deploys, and pull requests get preview URLs.

For accounts, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Settings → Environment Variables and redeploy. They are read at build time, so a running deploy won't pick them up until it rebuilds. Leave them off and accounts still work on-device only.
