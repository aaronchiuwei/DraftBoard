#!/usr/bin/env node
/**
 * Refreshes src/data/injuries.2026.json from ESPN and Sleeper.
 *
 * ESPN supplies return dates; Sleeper is cross-referenced for fantasy-specific
 * tags (PUP vs Out) and catches pool players ESPN omits. Yahoo has no public
 * injury API worth scraping.
 *
 *   node scripts/fetch-injuries.mjs [--season 2026]
 */

import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const SLEEPER = 'https://api.sleeper.app/v1';

/** Pool abbreviation -> Sleeper. */
const TO_SLEEPER = { JAC: 'JAX' };
/** Sleeper abbreviation -> pool. */
const FROM_SLEEPER = { JAX: 'JAC', WSH: 'WAS' };

const season = Number(argValue('--season') ?? 2026);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'data', `injuries.${season}.json`);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function nameKey(value) {
  return normalize((value ?? '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ''));
}

function espnTag(status, typeAbbr) {
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
  if (status && map[status]) return map[status];
  if (typeAbbr === 'O') return 'OUT';
  return typeAbbr ?? status?.slice(0, 4).toUpperCase();
}

function sleeperTag(status) {
  const map = {
    Questionable: 'Q',
    Doubtful: 'D',
    Out: 'OUT',
    PUP: 'PUP',
    IR: 'IR',
    Sus: 'SUSP',
    DNR: 'DNR',
    COV: 'COV'
  };
  return map[status] ?? status?.slice(0, 4).toUpperCase();
}

function espnInjuryLabel(details) {
  if (!details) return undefined;
  const type = details.type;
  if (!type || type === 'Undisclosed') return undefined;
  const side = details.side && details.side !== 'Not Specified' ? `${details.side} ` : '';
  const detail = details.detail && details.detail !== 'Not Specified' ? ` (${details.detail})` : '';
  return `${side}${type}${detail}`;
}

function sleeperInjuryLabel(athlete) {
  const part = athlete.injury_body_part;
  if (!part || part === 'Undisclosed') return undefined;
  const notes =
    athlete.injury_notes && athlete.injury_notes !== 'Not Specified'
      ? ` (${athlete.injury_notes})`
      : '';
  return `${part}${notes}`;
}

/** Higher wins; PUP beats OUT at the same tier; Sleeper breaks ties. */
const SEVERITY = { Q: 1, DTD: 1, DNR: 1, D: 2, OUT: 3, PUP: 3, COV: 3, SUSP: 4, IR: 5 };

function pickTag(espn, sleeper) {
  if (!espn) return sleeper;
  if (!sleeper) return espn;
  const a = SEVERITY[espn] ?? 2;
  const b = SEVERITY[sleeper] ?? 2;
  if (b > a) return sleeper;
  if (a > b) return espn;
  if (espn === 'OUT' && sleeper === 'PUP') return 'PUP';
  return sleeper;
}

const TAG_STATUS = {
  Q: 'Questionable',
  D: 'Doubtful',
  OUT: 'Out',
  IR: 'Injured Reserve',
  PS: 'Practice Squad',
  SUSP: 'Suspended',
  PUP: 'Physically Unable to Perform',
  NFI: 'Non-Football Injury',
  DTD: 'Day-To-Day',
  DNR: 'Did Not Report',
  COV: 'COVID-19'
};

function indexSleeper(directory) {
  const byName = new Map();
  for (const athlete of Object.values(directory)) {
    if (!athlete.full_name || athlete.position === 'DEF') continue;
    const key = nameKey(athlete.full_name);
    const list = byName.get(key);
    if (list) list.push(athlete);
    else byName.set(key, [athlete]);
  }
  return byName;
}

function matchSleeper(name, team, pos, index) {
  const sleeperTeam = TO_SLEEPER[team] ?? team;
  const plays = a =>
    a.position === pos || (a.fantasy_positions ?? []).includes(pos);

  const named = (index.get(nameKey(name)) ?? []).filter(plays);
  if (named.length === 1) return named[0];
  if (named.length > 1) return named.find(a => a.team === sleeperTeam) ?? named[0];
  return null;
}

function sleeperSnapshot(athlete) {
  if (!athlete.injury_status) return null;
  return {
    tag: sleeperTag(athlete.injury_status),
    status: athlete.injury_status,
    ...(sleeperInjuryLabel(athlete) ? { injury: sleeperInjuryLabel(athlete) } : {})
  };
}

async function fetchEspn() {
  const [injuryData, teamList] = await Promise.all([
    getJson(`${ESPN}/injuries`),
    getJson(`${ESPN}/teams`)
  ]);

  const teams = (teamList.sports?.[0]?.leagues?.[0]?.teams ?? []).map(t => t.team);
  const abbrByName = new Map(teams.map(t => [t.displayName, t.abbreviation]));
  const entries = new Map();

  for (const team of injuryData.injuries ?? []) {
    const rawAbbr = abbrByName.get(team.displayName);
    const code = rawAbbr === 'JAX' ? 'JAC' : rawAbbr === 'WSH' ? 'WAS' : (rawAbbr ?? team.id);

    for (const inj of team.injuries ?? []) {
      if (!inj.status || inj.status === 'Active') continue;
      const name = inj.athlete?.displayName ?? inj.athlete?.shortName;
      if (!name) continue;

      const details = inj.details ?? {};
      const key = nameKey(name);
      entries.set(key, {
        name,
        team: code,
        espn: {
          tag: espnTag(inj.status, inj.type?.abbreviation),
          status: inj.status,
          ...(espnInjuryLabel(details) ? { injury: espnInjuryLabel(details) } : {}),
          ...(inj.date ? { injuryDate: inj.date.slice(0, 10) } : {}),
          ...(details.returnDate ? { returnDate: details.returnDate } : {})
        }
      });
    }
  }
  return entries;
}

function mergeEntry(base) {
  const { espn, sleeper } = base;
  const tag = pickTag(espn?.tag, sleeper?.tag);
  const lead = espn && espn.tag === tag ? espn : sleeper;
  const agree = espn && sleeper ? espn.tag === sleeper.tag : undefined;

  return {
    name: base.name,
    team: base.team,
    tag,
    status: lead?.status ?? TAG_STATUS[tag] ?? tag,
    ...(espn?.injury || sleeper?.injury
      ? { injury: espn?.injury ?? sleeper?.injury }
      : {}),
    ...(espn?.injuryDate ? { injuryDate: espn.injuryDate } : {}),
    ...(espn?.returnDate ? { returnDate: espn.returnDate } : {}),
    ...(espn ? { espn } : {}),
    ...(sleeper ? { sleeper } : {}),
    ...(agree === false ? { agree: false } : agree ? { agree: true } : {})
  };
}

async function main() {
  process.stdout.write(`Fetching ${season} injuries from ESPN and Sleeper\n`);

  const pool = require(path.join(root, 'src', 'data', `players.${season}.json`));
  const [espnEntries, sleeperDirectory] = await Promise.all([
    fetchEspn(),
    getJson(`${SLEEPER}/players/nfl`)
  ]);

  const sleeperIndex = indexSleeper(sleeperDirectory);
  let matchedSleeper = 0;
  let disagreements = 0;
  let sleeperOnly = 0;

  for (const player of pool.players) {
    const athlete = matchSleeper(player.name, player.team, player.pos, sleeperIndex);
    const snap = athlete ? sleeperSnapshot(athlete) : null;
    if (!snap) continue;
    matchedSleeper++;

    const key = nameKey(player.name);
    const existing = espnEntries.get(key);
    if (existing) {
      existing.sleeper = snap;
      existing.team = player.team;
      if (existing.espn.tag !== snap.tag) disagreements++;
    } else {
      espnEntries.set(key, { name: player.name, team: player.team, sleeper: snap });
      sleeperOnly++;
    }
  }

  const players = [...espnEntries.values()].map(mergeEntry).sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    season,
    fetchedAt: new Date().toISOString().slice(0, 10),
    sources: ['ESPN', 'Sleeper'],
    players
  };

  await writeFile(outFile, `${JSON.stringify(payload)}\n`);

  process.stdout.write(
    `\nWrote ${path.relative(process.cwd(), outFile)}: ${players.length} players ` +
      `(${espnEntries.size - sleeperOnly} ESPN, ${matchedSleeper} Sleeper pool matches, ` +
      `${disagreements} tag disagreements, ${sleeperOnly} Sleeper-only pool adds)\n`
  );
}

main().catch(err => {
  process.stderr.write(`\nFailed: ${err.message}\n`);
  process.exit(1);
});
