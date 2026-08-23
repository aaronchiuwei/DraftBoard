#!/usr/bin/env node
/**
 * Builds src/data/research.2026.json from Yahoo Ultra PDF table transcriptions.
 *
 * Playcaller rows come from .tmp/playcallers.json (transcribed from PDF page 2).
 * OL, RB Volume, and Luck are embedded below from PDF pages 1, 6, and 7.
 *
 *   node scripts/build-research-data.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'data', 'research.2026.json');
const playcallerFile = path.join(root, '.tmp', 'playcallers.json');
const pool = require(path.join(root, 'src', 'data', 'players.2026.json'));

const TEAM_ALIASES = { JAX: 'JAC', CLV: 'CLE', HST: 'HOU', BLT: 'BAL' };

function normTeam(abbr) {
  return TEAM_ALIASES[abbr] ?? abbr;
}

const ol = {
  LAR: { olRank2025: 1, trend: 'down', cohesion: 4, olRank2026: 4.5, qbRuns: false },
  BUF: { olRank2025: 2, trend: 'down', cohesion: 4, olRank2026: 4.5, qbRuns: true },
  CHI: { olRank2025: 3, trend: 'down', cohesion: 4, olRank2026: 4, qbRuns: false },
  DEN: { olRank2025: 4, trend: 'neutral', cohesion: 5, olRank2026: 5, qbRuns: true },
  IND: { olRank2025: 5, trend: 'neutral', cohesion: 4, olRank2026: 4.5, qbRuns: false },
  SF: { olRank2025: 6, trend: 'neutral', cohesion: 4, olRank2026: 4, qbRuns: false },
  JAC: { olRank2025: 7, trend: 'neutral', cohesion: 5, olRank2026: 4, qbRuns: true },
  DAL: { olRank2025: 8, trend: 'neutral', cohesion: 5, olRank2026: 4, qbRuns: false },
  MIN: { olRank2025: 9, trend: 'up', cohesion: 4, olRank2026: 4, qbRuns: true },
  SEA: { olRank2025: 10, trend: 'neutral', cohesion: 5, olRank2026: 3.5, qbRuns: false },
  BAL: { olRank2025: 11, trend: 'down', cohesion: 2, olRank2026: 3, qbRuns: true },
  PIT: { olRank2025: 12, trend: 'up', cohesion: 3, olRank2026: 3.5, qbRuns: false },
  NE: { olRank2025: 13, trend: 'neutral', cohesion: 4, olRank2026: 3, qbRuns: false },
  PHI: { olRank2025: 14, trend: 'neutral', cohesion: 5, olRank2026: 4, qbRuns: true },
  DET: { olRank2025: 15, trend: 'neutral', cohesion: 3, olRank2026: 3.5, qbRuns: false },
  CAR: { olRank2025: 16, trend: 'down', cohesion: 3, olRank2026: 3, qbRuns: false },
  NYJ: { olRank2025: 17, trend: 'neutral', cohesion: 4, olRank2026: 3, qbRuns: false },
  NYG: { olRank2025: 18, trend: 'up', cohesion: 4, olRank2026: 3, qbRuns: true },
  CIN: { olRank2025: 19, trend: 'neutral', cohesion: 5, olRank2026: 3, qbRuns: false },
  GB: { olRank2025: 20, trend: 'down', cohesion: 3, olRank2026: 2, qbRuns: false },
  ATL: { olRank2025: 21, trend: 'up', cohesion: 4, olRank2026: 4, qbRuns: false },
  KC: { olRank2025: 22, trend: 'neutral', cohesion: 4, olRank2026: 3, qbRuns: false },
  ARI: { olRank2025: 23, trend: 'up', cohesion: 2, olRank2026: 3, qbRuns: false },
  WAS: { olRank2025: 24, trend: 'down', cohesion: 3, olRank2026: 2, qbRuns: true },
  TEN: { olRank2025: 25, trend: 'neutral', cohesion: 3, olRank2026: 2, qbRuns: false },
  TB: { olRank2025: 26, trend: 'up2', cohesion: 5, olRank2026: 4, qbRuns: false },
  CLE: { olRank2025: 27, trend: 'up', cohesion: 1, olRank2026: 2, qbRuns: false },
  LV: { olRank2025: 28, trend: 'up2', cohesion: 3, olRank2026: 2.5, qbRuns: false },
  HOU: { olRank2025: 29, trend: 'up', cohesion: 2, olRank2026: 3, qbRuns: false },
  NO: { olRank2025: 30, trend: 'up', cohesion: 4, olRank2026: 3, qbRuns: true },
  MIA: { olRank2025: 31, trend: 'up', cohesion: 4, olRank2026: 2.5, qbRuns: true },
  LAC: { olRank2025: 32, trend: 'up2', cohesion: 2, olRank2026: 3, qbRuns: false }
};

const rbVolumeRaw = [
  ['Christian McCaffrey', 1, 1, 'high'],
  ['Jahmyr Gibbs', 2, 2, 'high'],
  ['Bijan Robinson', 3, 3, 'high'],
  ['Ashton Jeanty', 4, 'T-11', 'high'],
  ['Jonathan Taylor', 5, 4, 'high'],
  ["De'Von Achane", 6, 7, 'high'],
  ['Chase Brown', 7, 6, 'mid'],
  ['James Cook', 8, 'T-14', 'mid'],
  ['Saquon Barkley', 9, 13, 'mid'],
  ['Kenneth Walker', 10, 8, 'mid'],
  ['Josh Jacobs', 11, 9, 'mid'],
  ['Javonte Williams', 12, 10, 'mid'],
  ['Omarion Hampton', 13, 'T-11', 'low'],
  ['Derrick Henry', 14, 18, 'mid'],
  ['Breece Hall', 15, 24, 'mid'],
  ['Jeremiyah Love', 16, null, 'low'],
  ['Cam Skattebo', 17, 5, 'mid'],
  ['Quinshon Judkins', 18, 17, 'mid'],
  ['Travis Etienne', 19, 16, 'mid'],
  ['Bucky Irving', 20, 'T-14', 'low'],
  ['David Montgomery', 21, 35, 'low'],
  ['Kyren Williams', 22, 19, 'low'],
  ['Chuba Hubbard', 23, 27, 'low'],
  ['Jaylen Warren', 24, 20, 'mid'],
  ['Rico Dowdle', 25, 23, 'mid'],
  ["D'Andre Swift", 26, 22, 'low'],
  ['Bhayshul Tuten', 27, null, 'low'],
  ['Tony Pollard', 28, 26, 'low'],
  ['Rhamondre Stevenson', 29, 25, 'mid'],
  ['Jadarian Price', 30, null, 'low'],
  ['TreVeyon Henderson', 31, 34, 'low'],
  ['RJ Harvey', 32, 28, 'low'],
  ['J.K. Dobbins', 33, 29, 'low'],
  ['Rachaad White', 34, 21, 'low'],
  ['Jordan Mason', 35, 38, 'low'],
  ['Kenneth Gainwell', 36, 30, 'low'],
  ['Kyle Monangai', 37, 33, 'low'],
  ['Jonathan Brooks', 38, null, 'low'],
  ['Jacory Croskey-Merritt', 39, 37, 'low'],
  ['Blake Corum', 40, 36, 'low']
];

const luckRaw = {
  unlucky: [
    ['CeeDee Lamb', 35.49, 17.73],
    ['Chris Olave', 23.46, 8.73],
    ['Marvin Harrison Jr.', 23.4, 18.22],
    ["Ja'Marr Chase", 22.78, 7.87],
    ['Amon-Ra St. Brown', 22.19, 7.41],
    ['Lamar Jackson', 20.96, 10.78],
    ['Puka Nacua', 20.81, 5.95],
    ['Rhamondre Stevenson', 18.32, 12.81],
    ['Davante Adams', 17.5, 7.86],
    ['Alec Pierce', 17.25, 11.2],
    ['Jaylen Waddle', 17.06, 8.81],
    ['Joe Burrow', 16.32, 14.39],
    ['Tee Higgins', 14.7, 7.61],
    ['Jayden Higgins', 14.09, 11.74],
    ['Jaxson Dart', 14.06, 6.36],
    ['Josh Jacobs', 13.28, 5.6],
    ['Trevor Lawrence', 12.7, 4.03],
    ['Jayden Daniels', 12.45, 10.91],
    ['Zay Flowers', 12.16, 5.72],
    ['Michael Wilson', 11.49, 5.74],
    ['Brian Thomas Jr.', 11.14, 8.49],
    ['Jake Ferguson', 11.11, 5.93],
    ["De'Von Achane", 10.48, 3.24],
    ['DeVonta Smith', 10.14, 5.24],
    ['Ladd McConkey', 10.0, 5.53]
  ],
  lucky: [
    ["D'Andre Swift", -5.06, -2.27],
    ['Josh Allen', -5.2, -1.43],
    ['Jalen Hurts', -5.25, -1.75],
    ['Chase Brown', -5.46, -2.07],
    ["Wan'Dale Robinson", -5.71, -2.62],
    ['Rico Dowdle', -6.49, -3.05],
    ['Bijan Robinson', -6.78, -1.87],
    ['Quinshon Judkins', -6.92, -4.08],
    ['Matthew Stafford', -7.42, -2.29],
    ['Tyler Warren', -9.84, -5.44],
    ['Baker Mayfield', -10.64, -4.11],
    ['Travis Kelce', -11.5, -6.09],
    ['Travis Etienne', -11.75, -4.71],
    ['Patrick Mahomes', -12.38, -4.36],
    ['Luther Burden III', -13.38, -11.11],
    ['David Montgomery', -14.7, -9.19],
    ['DJ Moore', -16.22, -9.65],
    ['Dak Prescott', -16.41, -5.23],
    ['Bo Nix', -16.6, -5.64],
    ['Jonathan Taylor', -16.84, -4.72],
    ['RJ Harvey', -18.28, -9.07],
    ['Jahmyr Gibbs', -19.0, -5.47],
    ['Caleb Williams', -25.29, -8.41],
    ['Christian McCaffrey', -30.92, -7.64],
    ['Dallas Goedert', -35.09, -19.02]
  ]
};

function normalizeName(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

function findPlayerId(name) {
  const key = normalizeName(name);
  for (const p of pool.players) {
    if (normalizeName(p.name) === key) return p.id;
  }
  const matches = pool.players.filter(p => normalizeName(p.name).includes(key.slice(0, 8)));
  if (matches.length === 1) return matches[0].id;
  return null;
}

function parseRank(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/^T-/, '');
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const rbVolume = {};
for (const [name, proj, adj, confidence] of rbVolumeRaw) {
  const id = findPlayerId(name);
  if (!id) continue;
  rbVolume[String(id)] = {
    name,
    projVolumeRank: parseRank(proj),
    adjVolumeRank: parseRank(adj),
    confidence
  };
}

const luck = {};
for (const [name, ptsLost, pctLost] of [...luckRaw.unlucky, ...luckRaw.lucky]) {
  const id = findPlayerId(name);
  if (!id) continue;
  luck[String(id)] = { name, ptsLost, pctLost };
}

const olByTeam = {};
for (const [abbr, row] of Object.entries(ol)) {
  olByTeam[normTeam(abbr)] = row;
}

const playcallerRaw = JSON.parse(await readFile(playcallerFile, 'utf8'));
const playcallerByTeam = {};
for (const row of playcallerRaw.playcallers) {
  playcallerByTeam[normTeam(row.team)] = { ...row, team: normTeam(row.team) };
}

const payload = {
  source: 'Yahoo Ultra PDF (Joel Smyth)',
  season: 2026,
  fetchedAt: new Date().toISOString().slice(0, 10),
  ol: olByTeam,
  playcallers: playcallerByTeam,
  rbVolume,
  luck
};

await writeFile(outFile, `${JSON.stringify(payload)}\n`);
process.stdout.write(`Wrote ${path.relative(process.cwd(), outFile)}\n`);
process.stdout.write(`  OL teams: ${Object.keys(olByTeam).length}\n`);
process.stdout.write(`  Playcallers: ${Object.keys(playcallerByTeam).length}\n`);
process.stdout.write(`  RB volume: ${Object.keys(rbVolume).length}\n`);
process.stdout.write(`  Luck entries: ${Object.keys(luck).length}\n`);
