// Fails the build if any private value from src/seed.local.json leaked into a built bundle.
// Values that also appear in the tracked src/seed.example.json are public, so they are ignored.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const seedPath = 'src/seed.local.json';
const examplePath = 'src/seed.example.json';
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['dist'];
if (!existsSync(seedPath)) {
  console.log('check-dist: no seed.local.json, nothing to leak.');
  process.exit(0);
}

const flatten = (v, path = '', out = []) => {
  if (typeof v === 'string') out.push([path, v]);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flatten(x, path ? `${path}.${k}` : k, out);
  return out;
};

const isPublic = new Set(existsSync(examplePath) ? flatten(JSON.parse(readFileSync(examplePath, 'utf8'))).map(([, v]) => v) : []);
const needles = flatten(JSON.parse(readFileSync(seedPath, 'utf8'))).filter(
  ([, v]) => v.length >= 6 && !/^(Online Transfer|UPI|Cash)$/.test(v) && !isPublic.has(v),
);

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
    for (const [path, value] of needles) {
      if (text.includes(value)) {
        console.error(`check-dist: the value of "${path}" from ${seedPath} is in ${file}`);
        bad++;
      }
    }
  }
}
if (bad) process.exit(1);
console.log(`check-dist: ${needles.length} private values, none in ${dirs.join(', ')}.`);
