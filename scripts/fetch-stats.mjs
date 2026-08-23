#!/usr/bin/env node
/**
 * Refreshes src/data/stats.2026.json from Sleeper.
 *
 * Two seasons per player: what he actually did last year, and what he is
 * projected to do this year. Both are baked into the bundle for the same
 * reason the player pool and the depth charts are — the moment you want a
 * stat line is the moment you are sitting in a room with no signal.
 *
 * Sleeper keys everything by its own player id, and our pool has no external
 * ids at all, so the bulk of the work here is matching 300 names to it. The
 * match is reported at the end and is expected to be complete; a name that
 * falls through silently would show up mid-draft as an empty stat panel.
 *
 * Headshots are the exception to baking things in: they are ~100KB each and
 * 300 of them would dwarf the app. Only the id is stored, and the sheet loads
 * the image from Sleeper's CDN when there is a connection.
 *
 *   node scripts/fetch-stats.mjs [--season 2026]
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const API = 'https://api.sleeper.app/v1';
const STATS_API = 'https://api.sleeper.com';

/** Our pool's abbreviation differs from Sleeper's for one team. */
const TEAM_CODE_FIXES = { JAC: 'JAX' };

/**
 * Sleeper stat key -> our key. Everything outside this list is dropped: the
 * raw payload carries about ninety fields per player, almost all of which are
 * things like snap counts that no draft decision turns on.
 */
const FIELDS = [
  ['gp', 'gp'],
  ['pts_ppr', 'pts'],
  ['pass_att', 'pa'],
  ['pass_cmp', 'pc'],
  ['pass_yd', 'py'],
  ['pass_td', 'pt'],
  ['pass_int', 'pi'],
  ['rush_att', 'ra'],
  ['rush_yd', 'ry'],
  ['rush_td', 'rt'],
  ['rec_tgt', 'tgt'],
  ['rec', 'rec'],
  ['rec_yd', 'recy'],
  ['rec_td', 'rect'],
  ['fgm', 'fgm'],
  ['fga', 'fga'],
  ['xpm', 'xpm'],
  ['sack', 'sack'],
  ['int', 'int'],
  ['fum_rec', 'fr'],
  ['def_td', 'dtd'],
  ['pts_allow', 'pa_allow'],
  ['rec_rz_tgt', 'rzRec'],
  ['rush_rz_att', 'rzRush'],
  ['pass_rz_att', 'rzPass']
];

const WEEKLY_BATCH = 12;

const require = createRequire(import.meta.url);
const season = Number(argValue('--season') ?? 2026);
const lastSeason = season - 1;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'data', `stats.${season}.json`);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Weekly actual vs projected PPR for last season — beat rate and avg delta. */
async function weeklyPerformance(sleeperId, season) {
  const [actuals, projections] = await Promise.all([
    getJson(
      `${STATS_API}/stats/nfl/player/${sleeperId}?season=${season}&season_type=regular&grouping=week`
    ),
    getJson(
      `${STATS_API}/projections/nfl/player/${sleeperId}?season=${season}&season_type=regular&grouping=week`
    )
  ]);

  let beats = 0;
  let compared = 0;
  let deltaSum = 0;

  for (const [week, row] of Object.entries(actuals)) {
    const actualPts = row?.stats?.pts_ppr;
    const projPts = projections?.[week]?.stats?.pts_ppr;
    if (typeof actualPts !== 'number' || typeof projPts !== 'number') continue;
    compared++;
    deltaSum += actualPts - projPts;
    if (actualPts > projPts) beats++;
  }

  if (compared === 0) return null;
  return {
    vsProj: Math.round((deltaSum / compared) * 10) / 10,
    beatPct: Math.round((beats / compared) * 1000) / 10
  };
}

async function mapInBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...(await Promise.all(batch.map(fn))));
    if (i + size < items.length) await sleep(120);
  }
  return out;
}

/** Lowercase letters only, so "D.J." and "DJ" are the same name. */
function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

/** Generational suffixes are inconsistent between sources and never disambiguate. */
function nameKey(value) {
  return normalize((value ?? '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ''));
}

function lastNameOf(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(w => !/^(jr|sr|ii|iii|iv|v)\.?$/i.test(w));
  return nameKey(parts[parts.length - 1] ?? '');
}

/**
 * Two indexes over Sleeper's directory: exact full name, and last name scoped
 * to a team and position. The second is what catches a player the sources
 * disagree about, like a "Hollywood" who is listed as "Marquise".
 */
function indexAthletes(directory) {
  const byName = new Map();
  const byLastName = new Map();

  const add = (map, key, value) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const athlete of Object.values(directory)) {
    if (athlete.position === 'DEF' || !athlete.player_id) continue;
    add(byName, nameKey(athlete.full_name), athlete);
    add(byLastName, `${nameKey(athlete.last_name)}|${athlete.team ?? ''}|${athlete.position}`, athlete);
  }
  return { byName, byLastName };
}

function matchAthlete(player, index) {
  const team = TEAM_CODE_FIXES[player.team] ?? player.team;
  const playsPosition = a =>
    a.position === player.pos || (a.fantasy_positions ?? []).includes(player.pos);

  const named = (index.byName.get(nameKey(player.name)) ?? []).filter(playsPosition);
  if (named.length === 1) return named[0];
  // a shared name is settled by the team, and only then by the first listing
  if (named.length > 1) return named.find(a => a.team === team) ?? named[0];

  const fallback = index.byLastName.get(`${lastNameOf(player.name)}|${team}|${player.pos}`);
  return fallback?.[0] ?? null;
}

/**
 * A line with every zero and every absent field stripped. An untouched stat is
 * not the same as a zero, and the sheet needs to be able to tell them apart.
 */
function statLine(raw) {
  if (!raw) return null;
  const out = {};
  for (const [from, to] of FIELDS) {
    const value = raw[from];
    if (typeof value !== 'number' || value === 0) continue;
    out[to] = Math.round(value * 10) / 10;
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function main() {
  process.stdout.write(`Fetching ${lastSeason} stats and ${season} projections from Sleeper\n`);

  const pool = require(path.join(root, 'src', 'data', 'players.2026.json'));
  const [directory, actuals, projections] = await Promise.all([
    getJson(`${API}/players/nfl`),
    getJson(`${API}/stats/nfl/regular/${lastSeason}`),
    getJson(`${API}/projections/nfl/regular/${season}`)
  ]);

  const index = indexAthletes(directory);
  const players = {};
  const unmatched = [];
  const weeklyQueue = [];
  let withActual = 0;
  let withProjection = 0;

  for (const player of pool.players) {
    // team defenses are keyed by the team code itself, so they need no matching
    const sleeperId =
      player.pos === 'DEF'
        ? (TEAM_CODE_FIXES[player.team] ?? player.team)
        : (matchAthlete(player, index)?.player_id ?? null);

    if (!sleeperId) {
      unmatched.push(`${player.name} (${player.team} ${player.pos})`);
      continue;
    }

    const actual = statLine(actuals[sleeperId]);
    const projected = statLine(projections[sleeperId]);
    if (!actual && !projected) continue;
    if (actual) withActual++;
    if (projected) withProjection++;

    players[player.id] = {
      sid: sleeperId,
      // a team defense has no portrait, so it carries no headshot id
      ...(player.pos === 'DEF' ? {} : { shot: sleeperId }),
      ...(actual ? { a: actual } : {}),
      ...(projected ? { p: projected } : {})
    };

    if (actual && player.pos !== 'DEF') {
      weeklyQueue.push({ id: player.id, sid: sleeperId });
    }
  }

  process.stdout.write(
    `Fetching weekly performance for ${weeklyQueue.length} players (${lastSeason})\n`
  );
  await mapInBatches(weeklyQueue, WEEKLY_BATCH, async ({ id, sid }) => {
    const perf = await weeklyPerformance(sid, lastSeason);
    if (perf) players[id].perf = perf;
  });

  const payload = {
    actualSeason: lastSeason,
    projectedSeason: season,
    fetchedAt: new Date().toISOString().slice(0, 10),
    source: 'Sleeper',
    scoring: 'PPR',
    players
  };

  await writeFile(outFile, `${JSON.stringify(payload)}\n`);

  process.stdout.write(
    `\nWrote ${path.relative(process.cwd(), outFile)}: ${Object.keys(players).length} of ` +
      `${pool.players.length} players, ${withActual} with ${lastSeason} stats, ` +
      `${withProjection} with ${season} projections\n`
  );
  if (unmatched.length > 0) {
    process.stdout.write(`\n${unmatched.length} not found on Sleeper:\n`);
    for (const name of unmatched) process.stdout.write(`  ${name}\n`);
  }
}

main().catch(err => {
  process.stderr.write(`\nFailed: ${err.message}\n`);
  process.exit(1);
});
