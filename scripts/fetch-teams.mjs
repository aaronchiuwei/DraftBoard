#!/usr/bin/env node
/**
 * Refreshes src/data/teams.2026.json from Sleeper team stat lines.
 *
 * Each NFL team carries a TEAM_{abbr} entry in Sleeper's season stats. We
 * rank offense and defense, then bake pass rate, pace, shootout environment,
 * and projected RB1 share so compare can show scheme context without a network
 * call mid-draft.
 *
 *   node scripts/fetch-teams.mjs [--season 2026]
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const API = 'https://api.sleeper.app/v1';

/** Our pool's abbreviation differs from Sleeper's for one team. */
const SLEEPER_TO_POOL = { JAX: 'JAC' };

const require = createRequire(import.meta.url);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const season = Number(argValue('--season') ?? 2026);
const lastSeason = season - 1;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'data', `teams.${season}.json`);

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

  const pool = require(path.join(root, 'src', 'data', 'players.2026.json'));
  await getJson(`${API}/projections/nfl/regular/${season}`);
  const stats = await getJson(`${API}/stats/nfl/regular/${lastSeason}`);

  let statsFile;
  try {
    statsFile = require(path.join(root, 'src', 'data', `stats.${season}.json`));
  } catch {
    statsFile = null;
  }

  const rbPtsByTeam = new Map();
  if (statsFile?.players) {
    for (const player of pool.players) {
      if (player.pos !== 'RB' || player.team === 'FA') continue;
      const pts = statsFile.players[String(player.id)]?.p?.pts;
      if (typeof pts !== 'number' || pts <= 0) continue;
      const list = rbPtsByTeam.get(player.team) ?? [];
      list.push(pts);
      rbPtsByTeam.set(player.team, list);
    }
  }

  const rb1Shares = new Map();
  for (const [team, ptsList] of rbPtsByTeam) {
    const total = ptsList.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    const top = Math.max(...ptsList);
    rb1Shares.set(team, Math.round((top / total) * 1000) / 10);
  }

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

  const shootoutScore = rankBy(
    rows.map(r => {
      const o = ptsRank.get(r.abbr) ?? 16;
      const d = defRank.get(r.abbr) ?? 16;
      // Good offense (low ptsRank) + leaky defense (high defRank) = shootout-friendly
      return [r.abbr, (33 - o) + d];
    }),
    true
  );

  const teams = {};
  for (const row of rows) {
    teams[row.abbr] = {
      offRank: offRank.get(row.abbr) ?? null,
      defRank: defRank.get(row.abbr) ?? null,
      ptsRank: ptsRank.get(row.abbr) ?? null,
      shootoutRank: shootoutScore.get(row.abbr) ?? null,
      passRate: row.passRate === null ? null : Math.round(row.passRate * 1000) / 10,
      playsPerGame: row.playsPerGame === null ? null : Math.round(row.playsPerGame * 10) / 10,
      offYpp: row.offYpp === null ? null : Math.round(row.offYpp * 10) / 10,
      rb1Share: rb1Shares.get(row.abbr) ?? null
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
