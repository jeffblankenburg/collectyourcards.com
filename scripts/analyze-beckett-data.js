/**
 * Analyze Beckett checklist data for normalization challenges
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'data', 'beckett-checklists');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx')).slice(0, 50); // Sample 50 files

const players = new Map();
const teams = new Set();
const cardNumberFormats = new Set();
const rookieNotations = new Set();

console.log('Analyzing', files.length, 'files...\n');

files.forEach(file => {
  try {
    const wb = XLSX.readFile(path.join(dir, file));
    // Only analyze Base sheet for clean team/player data
    const sheetName = wb.SheetNames.find(s => s === 'Base') || wb.SheetNames[0];
    if (sheetName) {
      const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      data.forEach(row => {
        const cardNum = row[0];
        const name = row[1];
        const team = row[2];
        const notes = row[3];

        // Track card number formats
        if (cardNum !== undefined && cardNum !== null && cardNum !== '') {
          if (typeof cardNum === 'number') {
            cardNumberFormats.add('numeric');
          } else if (typeof cardNum === 'string') {
            if (cardNum.match(/^[A-Z0-9]+-/)) {
              cardNumberFormats.add('prefix-code');
            } else if (cardNum.match(/^\d+$/)) {
              cardNumberFormats.add('string-numeric');
            }
          }
        }

        // Track player names (skip multi-player cards)
        if (typeof name === 'string' && name.indexOf('/') === -1 && name.length > 2) {
          const key = name.toLowerCase().replace(/[^a-z]/g, '');
          if (key.length > 3) {
            if (!players.has(key)) players.set(key, new Set());
            players.get(key).add(name);
          }
        }

        // Track team names
        if (typeof team === 'string') {
          team.split(' / ').forEach(t => {
            const trimmed = t.trim();
            if (trimmed.length > 0) teams.add(trimmed);
          });
        }

        // Track rookie notations
        if (typeof notes === 'string') {
          if (notes.toLowerCase().includes('rookie') || notes.toLowerCase().includes('rc')) {
            rookieNotations.add(notes);
          }
        }
      });
    }
  } catch (e) {
    // Skip files with errors
  }
});

console.log('=== CARD NUMBER FORMATS ===');
console.log([...cardNumberFormats].join(', '));

console.log('\n=== PLAYER NAME VARIATIONS ===');
let varCount = 0;
players.forEach((variations, key) => {
  if (variations.size > 1) {
    console.log([...variations].join(' | '));
    varCount++;
    if (varCount > 30) return;
  }
});
console.log('Total players with variations:', varCount);

console.log('\n=== ROOKIE NOTATION VARIATIONS ===');
console.log([...rookieNotations].join(', '));

console.log('\n=== TEAM NAME ANALYSIS ===');
const teamList = [...teams].sort();
console.log('Total unique team names:', teamList.length);

// Group similar teams
const teamGroups = {};
teamList.forEach(team => {
  // Normalize for grouping
  const normalized = team.toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!teamGroups[normalized]) teamGroups[normalized] = [];
  teamGroups[normalized].push(team);
});

console.log('\nTeams that need normalization:');
Object.entries(teamGroups).forEach(([key, values]) => {
  if (values.length > 1) {
    console.log(' -', values.join(' | '));
  }
});

// Check for historical vs current team mappings
console.log('\nHistorical team names found:');
const historicalTeams = teamList.filter(t =>
  t.includes('Expos') ||
  t.includes('Brooklyn') ||
  t.includes('New York Giants') ||
  t.includes('St. Louis Browns') ||
  t.includes('Milwaukee Braves') ||
  t.includes('Devil Rays') ||
  t.includes('Indians') ||
  t.includes('Naps')
);
historicalTeams.forEach(t => console.log(' -', t));
