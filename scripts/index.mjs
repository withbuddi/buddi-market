#!/usr/bin/env node
// Every entry as one JSON document: `node scripts/index.mjs [out.json] [origin]`.
// The site calls this at build to publish withbuddi.com/plugins/index.json,
// which buddi's Browse tab reads. An entry the check has not written yet has
// no claims and is left out: the page never lists what nobody verified.
//
// Each plugin carries `widgets` (from its claims, as the check recorded them
// from the manifest), so Browse and the site can filter by widgets and draw
// each one from the plugin's own sample, without reading the claims block.
//
// Catalogue agents ride along as `agents`, with the persona and the skills
// inline (the whole lineup is well under 100 KB) and the avatar as a URL plus
// its hash, so buddi can recompute the package integrity from the entry and
// the fetched avatar alone (scripts/agents.mjs, agentIntegrity).
import { writeFileSync } from 'node:fs';
import { agentIntegrity, listAgents, readAgentPackage } from './agents.mjs';
import { listEntries, readEntry, stableJson, validateEntry, widgetsOf } from './lib.mjs';

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
    // What Browse's and the site's Widgets filter and previews read: id, title, sizes, settings, preview per size.
    widgets: widgetsOf(entry),
  });
}
const order = { 'by-buddi': 0, reviewed: 1 };
plugins.sort((a, b) => order[a.trust] - order[b.trust] || a.title.localeCompare(b.title));

const agents = [];
for (const name of listAgents()) {
  const pkg = readAgentPackage(name);
  const m = pkg.manifest;
  if (m.claims === undefined || typeof m.integrity !== 'string') {
    console.error(`skip  agent ${name}: the check has not written its claims yet`);
    continue;
  }
  if (agentIntegrity(pkg) !== m.integrity) {
    console.error(`skip  agent ${name}: its integrity does not match its files; run the check`);
    continue;
  }
  const base = `${origin}/plugins/agents/${name}`;
  agents.push({
    ...m,
    persona: pkg.persona,
    skills: Object.entries(pkg.skills).map(([file, text]) => ({ file, text })),
    avatar: { url: `${base}/avatar.png`, sha256: m.claims.avatar.sha256 },
    page: `${base}/`,
  });
}
agents.sort((a, b) => a.title.localeCompare(b.title));

writeFileSync(out, stableJson({ generatedAt: new Date().toISOString(), plugins, agents }));
console.log(`${plugins.length} plugins, ${agents.length} agents → ${out}`);
