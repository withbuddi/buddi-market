#!/usr/bin/env node
// The check: what a listing may claim is what the code does.
//
//   node scripts/check.mjs [--write] <name>...      (no names: every entry)
//
// For each entry it validates the hand-written fields, asks npm for the
// version (its integrity and publisher), reads the provenance npm holds for
// it, and runs `buddi plugins describe <npm>@<version> --json`, which stages
// the package exactly as an install would and reads its manifest. The result
// is the entry's `claims` block (plus `integrity`, `publisher`, `provenance`).
// With --write the entry is rewritten; without it the committed block must
// already match, or the check fails and prints the difference. That is what
// runs on every pull request.
import { writeFileSync } from 'node:fs';
import {
  FIRST_PARTY,
  authorName,
  describe,
  entryPath,
  listEntries,
  npmView,
  provenanceOf,
  readEntry,
  stableJson,
  validateEntry,
  withClaims,
} from './lib.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const names = args.filter((a) => a !== '--write');
const targets = names.length > 0 ? names : listEntries();

let failed = 0;
for (const name of targets) {
  try {
    await checkOne(name);
    console.log(`ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
process.exit(failed === 0 ? 0 : 1);

async function checkOne(name) {
  const entry = readEntry(name);
  const problems = validateEntry(name, entry);
  if (problems.length > 0) throw new Error(`\n  - ${problems.join('\n  - ')}`);

  const spec = `${entry.npm}@${entry.version}`;
  const view = npmView(spec);
  if (view.version !== entry.version) throw new Error(`npm has no ${spec}`);
  const integrity = view.dist?.integrity;
  if (typeof integrity !== 'string') throw new Error(`npm reports no integrity for ${spec}`);

  const provenance = await provenanceOf(entry.npm, entry.version, integrity);
  if (entry.trust === 'by-buddi') {
    if (provenance === null) throw new Error(`${spec} has no provenance on npm; "by-buddi" needs a version published from a withbuddi repository by its workflow`);
    if (!FIRST_PARTY.test(provenance.repository ?? '')) {
      throw new Error(`${spec} was built from ${provenance.repository}, which is not a withbuddi repository; its trust cannot be "by-buddi"`);
    }
  }
  if (provenance !== null && !String(provenance.repository).startsWith(entry.repository.replace(/\.git$/, ''))) {
    throw new Error(`the entry says the source is ${entry.repository}, the provenance says ${provenance.repository}`);
  }

  const described = describe(spec);
  if (described.package?.integrity !== integrity) {
    throw new Error(`buddi read ${described.package?.integrity ?? 'nothing'} where npm serves ${integrity}`);
  }
  const npmAuthor = authorName(view.author);
  const manifestAuthor = described.manifest?.author?.name;
  for (const [where, who] of [['npm', npmAuthor], ['the manifest', manifestAuthor]]) {
    if (who !== undefined && who !== entry.author.name) {
      throw new Error(`author: the entry says ${entry.author.name}, ${where} says ${who}`);
    }
  }
  if (view.license !== undefined && view.license !== entry.license) {
    throw new Error(`license: the entry says ${entry.license}, npm says ${view.license}`);
  }
  if (described.package?.buddiName !== undefined && described.package.buddiName !== entry.name) {
    throw new Error(`the package installs as "${described.package.buddiName}", the entry is "${entry.name}"`);
  }
  if (typeof described.package?.hostApi === 'string' && entry.hostApi !== described.package.hostApi) {
    throw new Error(`hostApi: the entry says ${entry.hostApi ?? 'nothing'}, the package says ${described.package.hostApi}`);
  }

  const next = withClaims(entry, described, view, provenance);
  const { checkedAt: _a, ...nextCmp } = next;
  const { checkedAt: _b, ...prevCmp } = entry;
  const same = JSON.stringify(nextCmp) === JSON.stringify(prevCmp);
  if (write) {
    if (!same) writeFileSync(entryPath(name), stableJson(next));
    return;
  }
  if (!same) {
    throw new Error(
      `its claims block is not what the code says. Run: node scripts/check.mjs --write ${name}\n` +
        diff(prevCmp, nextCmp),
    );
  }
}

/** The top-level keys that differ, one line each. Enough to see what moved. */
function diff(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const lines = [];
  for (const key of keys) {
    const x = JSON.stringify(a[key]);
    const y = JSON.stringify(b[key]);
    if (x !== y) lines.push(`  ${key}:\n    committed: ${x ?? '(absent)'}\n    computed:  ${y ?? '(absent)'}`);
  }
  return lines.join('\n');
}
