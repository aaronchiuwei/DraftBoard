#!/usr/bin/env node
/**
 * Refreshes src/data/injuries.2026.json from ESPN's league injury report.
 *
 * Same offline-first rationale as fetch-depth.mjs: baked at build time, no
 * runtime fetch, and ESPN sends no CORS header on this endpoint either.
 *
 *   node scripts/fetch-injuries.mjs [--season 2026]
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

const season = Number(argValue('--season') ?? 2026);
const outFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  `injuries.${season}.json`
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

/** Compressed for a phone-width row: "Questionable" reads fine as "Q". */
function shortTag(status, typeAbbr) {
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

function injuryLabel(details) {
  if (!details) return undefined;
  const type = details.type;
  if (!type || type === 'Undisclosed') return undefined;
  const side = details.side && details.side !== 'Not Specified' ? `${details.side} ` : '';
  const detail = details.detail && details.detail !== 'Not Specified' ? ` (${details.detail})` : '';
  return `${side}${type}${detail}`;
}

async function main() {
  process.stdout.write(`Fetching ${season} injury report from ESPN\n`);

  const [injuryData, teamList] = await Promise.all([
    getJson(`${SITE}/injuries`),
    getJson(`${SITE}/teams`)
  ]);

  const teams = (teamList.sports?.[0]?.leagues?.[0]?.teams ?? []).map(t => t.team);
  const abbrByName = new Map(teams.map(t => [t.displayName, t.abbreviation]));

  const entries = [];

  for (const team of injuryData.injuries ?? []) {
    const rawAbbr = abbrByName.get(team.displayName);
    const code =
      rawAbbr === 'JAX' ? 'JAC' : rawAbbr === 'WSH' ? 'WAS' : (rawAbbr ?? team.id);

    for (const inj of team.injuries ?? []) {
      if (!inj.status || inj.status === 'Active') continue;

      const name = inj.athlete?.displayName ?? inj.athlete?.shortName;
      if (!name) continue;

      const details = inj.details ?? {};
      const tag = shortTag(inj.status, inj.type?.abbreviation);

      entries.push({
        name,
        team: code,
        tag,
        status: inj.status,
        ...(injuryLabel(details) ? { injury: injuryLabel(details) } : {}),
        ...(details.returnDate ? { returnDate: details.returnDate } : {})
      });
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    season,
    fetchedAt: new Date().toISOString().slice(0, 10),
    source: 'ESPN',
    players: entries
  };

  await writeFile(outFile, `${JSON.stringify(payload)}\n`);

  process.stdout.write(
    `\nWrote ${path.relative(process.cwd(), outFile)}: ${entries.length} injured players\n`
  );
}

main().catch(err => {
  process.stderr.write(`\nFailed: ${err.message}\n`);
  process.exit(1);
});
