#!/usr/bin/env node
// Every entry as one JSON document: `node scripts/index.mjs [out.json] [origin]`.
// The site calls this at build to publish withbuddi.com/plugins/index.json,
// which buddi's Browse tab reads. An entry the check has not written yet has
// no claims and is left out: the page never lists what nobody verified.
import { writeFileSync } from 'node:fs';
import { listEntries, readEntry, stableJson, validateEntry } from './lib.mjs';

const [out = 'index.json', origin = 'https://withbuddi.com'] = process.argv.slice(2);
const plugins = [];
for (const name of listEntries()) {
  const entry = readEntry(name);
  const problems = validateEntry(name, entry);
  if (problems.length > 0) {
    console.error(`skip  ${name}: ${problems.join('; ')}`);
    continue;
  }
  if (entry.claims === undefined || typeof entry.integrity !== 'string') {
    console.error(`skip  ${name}: the check has not written its claims yet`);
    continue;
  }
  const base = `${origin}/plugins/${name}`;
  plugins.push({
    ...entry,
    icon: entry.icon ? `${base}/icon.svg` : null,
    screenshots: entry.screenshots.map((shot) => `${base}/${shot}`),
    page: `${base}/`,
  });
}
const order = { 'by-buddi': 0, reviewed: 1 };
plugins.sort((a, b) => order[a.trust] - order[b.trust] || a.title.localeCompare(b.title));
writeFileSync(out, stableJson({ generatedAt: new Date().toISOString(), plugins }));
console.log(`${plugins.length} plugins → ${out}`);
