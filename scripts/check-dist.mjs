// Fails the build if any private value from src/seed.local.json leaked into a built bundle.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const seedPath = 'src/seed.local.json';
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['dist'];
if (!existsSync(seedPath)) {
  console.log('check-dist: no seed.local.json, nothing to leak.');
  process.exit(0);
}

const needles = [];
const collect = (v) => {
  if (typeof v === 'string' && v.length >= 6 && !/^(Online Transfer|UPI|Cash)$/.test(v)) needles.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(JSON.parse(readFileSync(seedPath, 'utf8')));

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

let bad = 0;
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8');
    for (const n of needles) {
      if (text.includes(n)) {
        console.error(`check-dist: private value found in ${file}`);
        bad++;
      }
    }
  }
}
if (bad) process.exit(1);
console.log(`check-dist: ${needles.length} private values, none in ${dirs.join(', ')}.`);
