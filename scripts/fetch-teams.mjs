#!/usr/bin/env node
/**
 * Refreshes src/data/teams.2026.json from Sleeper team stat lines.
 *
 * Each NFL team carries a TEAM_{abbr} entry in Sleeper's season stats. We
 * rank offense and defense, then bake pass rate and pace so compare can show
 * scheme context without a network call mid-draft.
 *
 *   node scripts/fetch-teams.mjs [--season 2026]
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API = 'https://api.sleeper.app/v1';

/** Our pool's abbreviation differs from Sleeper's for one team. */
const SLEEPER_TO_POOL = { JAX: 'JAC' };
const POOL_TO_SLEEPER = { JAC: 'JAX' };

const season = Number(argValue('--season') ?? 2026);
const lastSeason = season - 1;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'data', `teams.${season}.json`);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Lower rank number = better (1st place). Ties share the same rank. */
function rankBy(entries, higherIsBetter) {
  const sorted = [...entries].sort((a, b) =>
    higherIsBetter ? b[1] - a[1] : a[1] - b[1]
  );
  const ranks = new Map();
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][1] !== sorted[i - 1][1]) rank = i + 1;
    ranks.set(sorted[i][0], rank);
  }
  return ranks;
}

function num(raw, key) {
  const v = raw?.[key];
  return typeof v === 'number' ? v : null;
}

async function main() {
  process.stdout.write(`Fetching ${lastSeason} team stats from Sleeper\n`);

  const stats = await getJson(`${API}/stats/nfl/regular/${lastSeason}`);
  const rows = [];

  for (const [key, raw] of Object.entries(stats)) {
    if (!key.startsWith('TEAM_')) continue;
    const abbr = SLEEPER_TO_POOL[key.slice(5)] ?? key.slice(5);
    const gp = num(raw, 'gp') ?? 17;
    const passAtt = num(raw, 'pass_att') ?? 0;
    const rushAtt = num(raw, 'rush_att') ?? 0;
    const plays = passAtt + rushAtt;
    const offYds = num(raw, 'off_yd');
    const oppOffYds = num(raw, 'opp_off_yd');
    const pts = num(raw, 'pts_ppr');
    const offYpp = plays > 0 && offYds !== null ? offYds / plays : null;
    const defYpg = gp > 0 && oppOffYds !== null ? oppOffYds / gp : null;

    rows.push({
      abbr,
      gp,
      offYds,
      offYpp,
      oppOffYds,
      defYpg,
      pts,
      passRate: plays > 0 ? passAtt / plays : null,
      playsPerGame: gp > 0 ? plays / gp : null
    });
  }

  const offRank = rankBy(
    rows.map(r => [r.abbr, r.offYpp ?? (r.offYds !== null && r.gp > 0 ? r.offYds / r.gp : 0)]),
    true
  );
  const defRank = rankBy(
    rows.map(r => [r.abbr, r.defYpg ?? r.oppOffYds ?? Infinity]),
    false
  );
  const ptsRank = rankBy(
    rows.map(r => [r.abbr, r.pts ?? 0]),
    true
  );

  const teams = {};
  for (const row of rows) {
    teams[row.abbr] = {
      offRank: offRank.get(row.abbr) ?? null,
      defRank: defRank.get(row.abbr) ?? null,
      ptsRank: ptsRank.get(row.abbr) ?? null,
      passRate: row.passRate === null ? null : Math.round(row.passRate * 1000) / 10,
      playsPerGame: row.playsPerGame === null ? null : Math.round(row.playsPerGame * 10) / 10,
      offYpp: row.offYpp === null ? null : Math.round(row.offYpp * 10) / 10
    };
  }

  const payload = {
    season: lastSeason,
    fetchedAt: new Date().toISOString().slice(0, 10),
    source: 'Sleeper',
    teams
  };

  await writeFile(outFile, `${JSON.stringify(payload)}\n`);
  process.stdout.write(
    `\nWrote ${path.relative(process.cwd(), outFile)}: ${Object.keys(teams).length} teams\n`
  );
}

main().catch(err => {
  process.stderr.write(`\nFailed: ${err.message}\n`);
  process.exit(1);
});
