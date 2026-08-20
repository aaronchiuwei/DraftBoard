#!/usr/bin/env node
/**
 * Refreshes src/data/depth.2026.json from ESPN.
 *
 * Depth charts are baked into the bundle rather than fetched at runtime, for
 * the same reason the player pool is: a draft room has bad signal, and the one
 * moment you want this data is the moment you cannot rely on the network.
 * ESPN's roster endpoint also sends no CORS header, so a browser could not
 * resolve athlete names on its own even with a connection.
 *
 * Two requests per team: the depth chart gives an ordered list of athlete ids,
 * the roster turns those ids into names, numbers, and injury status.
 *
 *   node scripts/fetch-depth.mjs [--season 2026]
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

/** ESPN's abbreviation differs from the player pool's for two teams. */
const TEAM_CODE_FIXES = { JAX: 'JAC', WSH: 'WAS' };

/**
 * ESPN depth-chart position key -> the group we file it under. Offensive line
 * and defense are dropped; nothing in a fantasy draft turns on the left guard.
 */
const GROUPS = [
  { key: 'QB', from: ['qb'] },
  { key: 'RB', from: ['rb', 'fb'] },
  { key: 'WR', from: ['wr'] },
  { key: 'TE', from: ['te'] },
  { key: 'K', from: ['pk'] }
];

const season = Number(argValue('--season') ?? 2026);
const outFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  `depth.${season}.json`
);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Athlete id -> name, number, and a short status, from a team's full roster. */
async function rosterIndex(espnId) {
  const data = await getJson(`${SITE}/teams/${espnId}/roster`);
  const index = new Map();

  for (const group of data.athletes ?? []) {
    for (const a of group.items ?? []) {
      const injury = (a.injuries ?? []).find(i => i.status && i.status !== 'Active');
      index.set(String(a.id), {
        name: a.fullName ?? a.displayName ?? '',
        jersey: a.jersey ? String(a.jersey) : undefined,
        pos: a.position?.abbreviation,
        // practiceSquad and injuredReserveOrOut are roster groups, not injuries
        status: shortStatus(injury?.status ?? statusFromGroup(group.position))
      });
    }
  }
  return { index, season: data.season };
}

function statusFromGroup(group) {
  if (group === 'injuredReserveOrOut') return 'Injured Reserve';
  if (group === 'suspended') return 'Suspended';
  if (group === 'practiceSquad') return 'Practice Squad';
  return undefined;
}

/** Compressed for a phone-width row: "Questionable" reads fine as "Q". */
function shortStatus(status) {
  if (!status) return undefined;
  const map = {
    Questionable: 'Q',
    Doubtful: 'D',
    Out: 'OUT',
    'Injured Reserve': 'IR',
    Suspended: 'SUSP',
    'Practice Squad': 'PS',
    'Physically Unable to Perform': 'PUP',
    'Non-Football Injury': 'NFI',
    'Day-To-Day': 'DTD'
  };
  return map[status] ?? status.slice(0, 4).toUpperCase();
}

function athleteIdFromRef(ref) {
  const m = /athletes\/(\d+)/.exec(ref ?? '');
  return m ? m[1] : null;
}

/**
 * A team has several depth charts (an offensive formation, a defensive front,
 * special teams). Positions are merged across all of them and filtered down to
 * the ones we care about, so a formation named "3WR 1TE" or "2TE" both work.
 */
function collectPositions(items) {
  const byKey = new Map();
  for (const chart of items ?? []) {
    for (const [key, entry] of Object.entries(chart.positions ?? {})) {
      const athletes = (entry.athletes ?? [])
        .map(a => ({ id: athleteIdFromRef(a.athlete?.$ref), rank: a.rank ?? 99 }))
        .filter(a => a.id);
      if (athletes.length === 0) continue;
      // a formation that lists more men at a spot is the more complete chart
      const existing = byKey.get(key);
      if (!existing || athletes.length > existing.length) byKey.set(key, athletes);
    }
  }
  return byKey;
}

function buildGroups(positions, roster, missing) {
  const groups = [];

  for (const group of GROUPS) {
    const seen = new Set();
    const players = [];

    for (const posKey of group.from) {
      const athletes = positions.get(posKey);
      if (!athletes) continue;
      for (const a of [...athletes].sort((x, y) => x.rank - y.rank)) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        const person = roster.get(a.id);
        if (!person?.name) {
          missing.push(a.id);
          continue;
        }
        players.push({
          name: person.name,
          ...(person.jersey ? { jersey: person.jersey } : {}),
          // the chart's own position, so an FB in the RB group still reads FB
          ...(person.pos && person.pos !== group.key ? { pos: person.pos } : {}),
          ...(person.status ? { status: person.status } : {})
        });
      }
    }

    if (players.length > 0) groups.push({ pos: group.key, players });
  }
  return groups;
}

async function main() {
  process.stdout.write(`Fetching ${season} depth charts from ESPN\n`);

  const teamList = await getJson(`${SITE}/teams`);
  const teams = (teamList.sports?.[0]?.leagues?.[0]?.teams ?? []).map(t => t.team);
  if (teams.length === 0) throw new Error('no teams in the ESPN team list');

  const out = [];
  const missing = [];
  let seasonMeta = null;

  for (const team of teams) {
    const espnAbbr = team.abbreviation;
    const code = TEAM_CODE_FIXES[espnAbbr] ?? espnAbbr;

    const [charts, roster] = await Promise.all([
      getJson(`${CORE}/seasons/${season}/teams/${team.id}/depthcharts`),
      rosterIndex(team.id)
    ]);
    seasonMeta ??= roster.season;

    const groups = buildGroups(collectPositions(charts.items), roster.index, missing);
    out.push({
      code,
      name: team.displayName,
      short: team.shortDisplayName,
      groups
    });

    const n = groups.reduce((sum, g) => sum + g.players.length, 0);
    process.stdout.write(`  ${code.padEnd(4)} ${String(n).padStart(2)} players\n`);
  }

  out.sort((a, b) => a.code.localeCompare(b.code));

  const payload = {
    season,
    label: seasonMeta?.displayName
      ? `${seasonMeta.displayName} ${seasonMeta.name ?? ''}`.trim()
      : String(season),
    fetchedAt: new Date().toISOString().slice(0, 10),
    source: 'ESPN',
    teams: out
  };

  await writeFile(outFile, `${JSON.stringify(payload)}\n`);

  const total = out.reduce(
    (sum, t) => sum + t.groups.reduce((n, g) => n + g.players.length, 0),
    0
  );
  process.stdout.write(
    `\nWrote ${path.relative(process.cwd(), outFile)}: ${out.length} teams, ${total} players\n`
  );
  if (missing.length > 0) {
    process.stdout.write(
      `${missing.length} charted athletes were not on any roster and were skipped\n`
    );
  }
}

main().catch(err => {
  process.stderr.write(`\nFailed: ${err.message}\n`);
  process.exit(1);
});
