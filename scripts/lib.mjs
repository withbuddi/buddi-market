// What every script here shares: reading an entry, asking npm about a
// version, reading its provenance, and asking buddi what the package brings.
// Nothing in this file writes.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGINS_DIR = path.join(ROOT, 'plugins');

export const CATEGORIES = ['days', 'money', 'home', 'voice', 'work', 'other'];
export const TRUST = ['by-buddi', 'reviewed'];
export const PRICING = ['free', 'paid', 'subscription'];
/** Repositories whose provenance makes a plugin "by buddi". */
export const FIRST_PARTY = /^https:\/\/github\.com\/withbuddi\//;

export function listEntries() {
  if (!existsSync(PLUGINS_DIR)) return [];
  return readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(PLUGINS_DIR, d.name, 'entry.json')))
    .map((d) => d.name)
    .sort();
}

export function entryPath(name) {
  return path.join(PLUGINS_DIR, name, 'entry.json');
}

export function readEntry(name) {
  return JSON.parse(readFileSync(entryPath(name), 'utf8'));
}

/** What a hand-written entry must say. Returns a list of problems, empty when fine. */
export function validateEntry(name, e) {
  const problems = [];
  const str = (k, max = 200) => {
    if (typeof e[k] !== 'string' || e[k].trim() === '') problems.push(`${k} must be a non-empty string`);
    else if (e[k].length > max) problems.push(`${k} is longer than ${max} characters`);
  };
  if (e.name !== name) problems.push(`name must be "${name}", the directory it is in`);
  if (!/^[a-z0-9-]{2,40}$/.test(String(e.name))) problems.push('name must be lowercase letters, digits and dashes');
  str('npm', 214);
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(String(e.npm))) problems.push('npm is not a package name');
  str('version', 64);
  str('title', 40);
  str('summary', 240);
  if (!CATEGORIES.includes(e.category)) problems.push(`category must be one of ${CATEGORIES.join(', ')}`);
  if (!TRUST.includes(e.trust)) problems.push(`trust must be one of ${TRUST.join(', ')}`);
  if (typeof e.pricing !== 'object' || e.pricing === null || !PRICING.includes(e.pricing.kind)) {
    problems.push(`pricing.kind must be one of ${PRICING.join(', ')}`);
  } else if (e.pricing.kind !== 'free' && !/^https:\/\//.test(String(e.pricing.vendor))) {
    problems.push('a paid plugin names its vendor page (pricing.vendor, https)');
  }
  if (e.icon !== undefined) {
    if (e.icon !== 'icon.svg') problems.push('icon, when set, is "icon.svg" beside the entry');
    else if (!existsSync(path.join(PLUGINS_DIR, name, 'icon.svg'))) problems.push('icon.svg is named but missing');
  }
  if (!Array.isArray(e.screenshots)) problems.push('screenshots must be a list (empty is fine)');
  else {
    for (const shot of e.screenshots) {
      if (typeof shot !== 'string' || !/^shots\/[a-z0-9-]+\.webp$/.test(shot)) problems.push(`screenshot "${shot}" must be shots/<name>.webp`);
      else if (!existsSync(path.join(PLUGINS_DIR, name, shot))) problems.push(`${shot} is named but missing`);
    }
  }
  if (typeof e.author !== 'object' || e.author === null || typeof e.author.name !== 'string') problems.push('author.name is required');
  if (e.author?.url !== undefined && !/^https:\/\//.test(String(e.author.url))) problems.push('author.url must be https');
  str('license', 60);
  if (!/^https:\/\//.test(String(e.repository))) problems.push('repository must be an https link to the source');
  if (e.trust === 'reviewed') {
    const r = e.reviewed;
    if (typeof r !== 'object' || r === null || r.version !== e.version || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.on)) || typeof r.covered !== 'string') {
      problems.push('a reviewed plugin carries reviewed: { version (this one), on (YYYY-MM-DD), covered }');
    }
  }
  return problems;
}

export function npmView(spec) {
  const out = execFileSync('npm', ['view', spec, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
}

/** The SLSA provenance npm holds for this version, or null when it has none. */
export async function provenanceOf(npm, version, integrity) {
  const url = `https://registry.npmjs.org/-/npm/v1/attestations/${encodeURIComponent(npm)}@${version}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`attestations: ${res.status} for ${npm}@${version}`);
  const { attestations = [] } = await res.json();
  const slsa = attestations.find((a) => a.predicateType === 'https://slsa.dev/provenance/v1');
  if (!slsa?.bundle?.dsseEnvelope?.payload) return null;
  const statement = JSON.parse(Buffer.from(slsa.bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
  const subject = (statement.subject ?? []).find((s) => s.digest?.sha512);
  const digest = subject ? `sha512-${Buffer.from(subject.digest.sha512, 'hex').toString('base64')}` : undefined;
  if (digest !== integrity) {
    throw new Error(`the provenance for ${npm}@${version} attests ${digest ?? 'nothing'}, npm serves ${integrity}`);
  }
  const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow ?? {};
  const dep = (statement.predicate?.buildDefinition?.resolvedDependencies ?? [])[0];
  return {
    repository: workflow.repository ?? null,
    workflow: workflow.path ?? null,
    ref: workflow.ref ?? null,
    commit: dep?.digest?.gitCommit ?? null,
    run: statement.predicate?.runDetails?.metadata?.invocationId ?? null,
  };
}

/** `buddi plugins describe <spec> --json`, from the buddi on PATH or BUDDI_BIN. */
export function describe(spec) {
  const bin = process.env.BUDDI_BIN ?? 'buddi';
  const out = execFileSync(bin, ['plugins', 'describe', spec, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, BUDDI_VAULT: process.env.BUDDI_VAULT ?? 'memory' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

/** package.json's author, as npm serves it: a string or an object. */
export function authorName(author) {
  if (typeof author === 'string') return author.replace(/\s*[(<].*$/, '').trim();
  if (author && typeof author.name === 'string') return author.name.trim();
  return undefined;
}

/** The entry with what the check computed: the block the page and buddi read from. */
export function withClaims(entry, described, view, provenance) {
  const { package: pkg, ...rest } = described;
  // The publisher npm names depends on which npm asks (a maintainer or "GitHub
  // Actions"), so it is not kept: integrity and provenance are the facts.
  const { integrity, publisher: _publisher, ...pkgRest } = pkg;
  const { publisher: _old, ...rest } = entry;
  return {
    ...rest,
    integrity,
    provenance,
    claims: { package: pkgRest, ...rest },
    checkedAt: new Date().toISOString().slice(0, 10),
  };
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
