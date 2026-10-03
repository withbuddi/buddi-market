// Catalogue agents: reading a package, validating it, its integrity and the
// claims the check writes. An agent is configuration, never code: a manifest
// (agent.json), a persona, text skills and an avatar. Nothing in this file
// writes; check.mjs does, with --write.
//
// The package format is specs/agent-catalogue.md §3; the schema is
// schemas/agent.schema.json and this file interprets it, so the schema is the
// one statement of what a field may hold.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, listEntries, readEntry } from './lib.mjs';

export const AGENTS_DIR = path.join(ROOT, 'agents');
export const SCHEMA = JSON.parse(readFileSync(path.join(ROOT, 'schemas', 'agent.schema.json'), 'utf8'));

export const LIMITS = {
  persona: 16 * 1024,
  skill: 8 * 1024,
  skills: 8,
  avatar: 200 * 1024,
  avatarPx: 512,
};

/** Fields v1 refuses by name, with the reason the refusal gives. */
const REFUSED = {
  model: 'the agent thinks with the account the owner\'s default agent uses',
  provider: 'the agent thinks with the account the owner\'s default agent uses',
  account: 'the agent thinks with the account the owner\'s default agent uses',
  delegates: 'a catalogue agent hands work to nobody until the owner says so',
  bundles: 'skill bundles with scripts wait for the Skills zone; plain skills/*.md only',
};

/**
 * The v1 denylist (§9), on top of buddi's own checkTools: never grantable by a
 * package, whatever the glob. The owner can add any of these by hand later.
 */
export const DENIED = [
  /^host\./,
  /^secret\./,
  /^secrets\./,
  /^developer\./,
  /^mcp\./,
  /^agent\.delegate$/,
  /^owner\.set_profile$/,
  /^owner\.finish_onboarding$/,
  /^owner\.rename_me$/,
  /^email\.send$/,
  /^email\.add_account$/,
  /^email\.remove_account$/,
  /^email\.set_password$/,
];
/** platform.* is the dashboard's own: only its reads are grantable at all. */
const PLATFORM_READS = new Set([
  'platform.installed_tools', 'platform.list_accounts', 'platform.list_agents', 'platform.list_groups',
  'platform.list_skills', 'platform.plugin_agents', 'platform.read_agent',
]);

export function isDenied(tool) {
  if (tool.startsWith('platform.') && !PLATFORM_READS.has(tool)) return true;
  return DENIED.some((re) => re.test(tool));
}

export function listAgents() {
  if (!existsSync(AGENTS_DIR)) return [];
  return readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(AGENTS_DIR, d.name, 'agent.json')))
    .map((d) => d.name)
    .sort();
}

export function agentPath(name, file = 'agent.json') {
  return path.join(AGENTS_DIR, name, file);
}

/** The package as files: what the integrity covers and what the index ships. */
export function readAgentPackage(name, dir = path.join(AGENTS_DIR, name)) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'agent.json'), 'utf8'));
  const persona = existsSync(path.join(dir, 'persona.md')) ? readFileSync(path.join(dir, 'persona.md'), 'utf8') : null;
  const skillsDir = path.join(dir, 'skills');
  const skills = {};
  const strays = [];
  if (existsSync(skillsDir)) {
    for (const file of readdirSync(skillsDir).sort()) {
      if (file.endsWith('.md')) skills[file] = readFileSync(path.join(skillsDir, file), 'utf8');
      else strays.push(`skills/${file}`);
    }
  }
  for (const file of readdirSync(dir)) {
    if (!['agent.json', 'persona.md', 'skills', 'avatar.png'].includes(file)) strays.push(file);
  }
  const avatar = existsSync(path.join(dir, 'avatar.png')) ? readFileSync(path.join(dir, 'avatar.png')) : null;
  return { manifest, persona, skills, avatar, strays };
}

/* ------------------------------------------------------------------ *
 * Integrity
 * ------------------------------------------------------------------ */

/** JSON with every object's keys sorted, no whitespace: the same bytes whatever the key order. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(bytes) {
  return `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
}

/**
 * The package integrity (§3). sha256 over one canonical JSON document:
 *
 *   { "agent.json": <manifest without integrity and claims>,
 *     "persona.md": <its text>,
 *     "skills": { "<file>.md": <its text>, … },
 *     "avatar.png": "sha256-<base64 of the avatar's sha256>" }
 *
 * canonical = keys sorted at every level (JS default string order), no
 * whitespace, JSON.stringify for strings. Texts are the files' UTF-8 exactly.
 * buddi recomputes this from the index entry (persona and skills ship inline)
 * plus the fetched avatar, and refuses a mismatch.
 */
export function agentIntegrity(pkg) {
  const { integrity: _i, claims: _c, ...manifest } = pkg.manifest;
  const doc = {
    'agent.json': manifest,
    'persona.md': pkg.persona ?? '',
    skills: pkg.skills,
    'avatar.png': pkg.avatar ? sha256(pkg.avatar) : null,
  };
  return sha256(Buffer.from(canonicalJson(doc), 'utf8'));
}

/* ------------------------------------------------------------------ *
 * The schema, interpreted (the subset schemas/agent.schema.json uses)
 * ------------------------------------------------------------------ */

export function schemaProblems(value, schema = SCHEMA, at = '') {
  const where = at || 'agent.json';
  const out = [];
  if ('const' in schema && value !== schema.const) out.push(`${where} must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) out.push(`${where} must be one of ${schema.enum.join(', ')}`);
  const type = schema.type;
  if (type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [...out, `${where} must be an object`];
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${at ? `${at}.` : ''}${key} is required`);
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      const name = at ? `${at}.${key}` : key;
      if (sub) out.push(...schemaProblems(v, sub, name));
      else if (schema.additionalProperties === false) {
        out.push(!at && REFUSED[key] ? `${key} is not allowed in v1: ${REFUSED[key]}` : `${name} is not a known field`);
      } else if (typeof schema.additionalProperties === 'object') out.push(...schemaProblems(v, schema.additionalProperties, name));
    }
  } else if (type === 'array') {
    if (!Array.isArray(value)) return [...out, `${where} must be a list`];
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${where} needs at least ${schema.minItems}`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(`${where} holds at most ${schema.maxItems}`);
    if (schema.items) value.forEach((v, i) => out.push(...schemaProblems(v, schema.items, `${where}[${i}]`)));
  } else if (type === 'string') {
    if (typeof value !== 'string') return [...out, `${where} must be a string`];
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) out.push(`${where} must not be empty`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) out.push(`${where} is longer than ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) out.push(`${where} does not match ${schema.pattern}`);
  } else if (type === 'boolean') {
    if (typeof value !== 'boolean') out.push(`${where} must be true or false`);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Semver, the little the check needs
 * ------------------------------------------------------------------ */

export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(v).trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split('.') : [] };
}

export function compareVersions(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a;
  const y = typeof b === 'string' ? parseVersion(b) : b;
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] - y[k];
  if (x.pre.length === 0 || y.pre.length === 0) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn && +p !== +q) return +p - +q;
    if (pn !== qn) return pn ? -1 : 1;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

/** `>=1.2.3`, `^1.2.3`, `~1.2.3`, `1.2.3`, or several joined by spaces (all must hold). */
export function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) return false;
  return String(range).trim().split(/\s+/).every((part) => {
    const m = /^(>=|>|<=|<|\^|~|=)?(.+)$/.exec(part);
    if (!m) return false;
    const op = m[1] ?? '=';
    const r = parseVersion(m[2]);
    if (!r) return false;
    const c = compareVersions(v, r);
    switch (op) {
      case '>=': return c >= 0;
      case '>': return c > 0;
      case '<=': return c <= 0;
      case '<': return c < 0;
      case '=': return c === 0;
      case '~': return c >= 0 && v.major === r.major && v.minor === r.minor;
      case '^':
        if (c < 0) return false;
        if (r.major > 0) return v.major === r.major;
        if (r.minor > 0) return v.major === 0 && v.minor === r.minor;
        return v.major === 0 && v.minor === 0 && v.patch === r.patch;
      default: return false;
    }
  });
}

export function validRange(range) {
  return String(range).trim().split(/\s+/).every((part) => /^(>=|>|<=|<|\^|~|=)?v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(part));
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

/** The tools a buddi release registers itself, with tiers: `buddi tools list --json`, else the snapshot. */
export function coreTools() {
  const bin = process.env.BUDDI_BIN ?? 'buddi';
  try {
    const out = execFileSync(bin, ['tools', 'list', '--core', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const parsed = JSON.parse(out);
    const tools = Array.isArray(parsed) ? parsed : parsed.tools;
    if (Array.isArray(tools) && tools.every((t) => typeof t.name === 'string' && typeof t.tier === 'string')) {
      return { source: `buddi tools list (${bin})`, tools: tools.map(({ name, tier, ownerOnly }) => ({ name, tier, ownerOnly: ownerOnly === true })) };
    }
  } catch {
    // No such command yet: the snapshot below.
  }
  const snap = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'core-tools.json'), 'utf8'));
  return { source: `snapshot of buddi ${snap.buddi}`, tools: snap.tools };
}

/** Every listed plugin's tools, from the claims the plugin check wrote. */
export function pluginTools() {
  const plugins = {};
  for (const name of listEntries()) {
    const entry = readEntry(name);
    plugins[name] = {
      version: entry.version,
      hostApi: entry.hostApi ?? null,
      title: entry.title,
      tools: (entry.claims?.manifest?.tools ?? []).map(({ name: t, tier, ownerOnly }) => ({ name: t, tier, ownerOnly: ownerOnly === true })),
    };
  }
  return plugins;
}

/** A glob or a name against a list of tools. Owner-only tools never match a glob (buddi's list() leaves them out). */
function matchTool(pattern, tools) {
  if (pattern.endsWith('.*')) {
    const family = pattern.slice(0, -1);
    return tools.filter((t) => t.name.startsWith(family) && !t.ownerOnly);
  }
  return tools.filter((t) => t.name === pattern);
}

/* ------------------------------------------------------------------ *
 * The persona lint (§9): simple, and the review is still the gate
 * ------------------------------------------------------------------ */

const ESCALATION = [
  [/\bwithout (?:asking|the owner'?s? (?:approval|consent|knowledge)|approval|confirmation)\b/i, 'acting without the owner\'s approval'],
  [/\b(?:bypass|skip|disable|get around|circumvent)\w* (?:the )?(?:approval|gate|card|check|denylist|confirmation)s?\b/i, 'getting around an approval'],
  [/\b(?:always allow|remember(?:ed)? (?:the |an )?approval|pre-?approved)\b/i, 'a remembered or assumed approval'],
  [/\b(?:do not|don't|never) (?:tell|inform|show|mention (?:this|it) to) the owner\b/i, 'hiding something from the owner'],
  [/\bhide (?:this|it|that) from the owner\b/i, 'hiding something from the owner'],
  [/\b(?:grant|give) yourself\b/i, 'granting itself something'],
  [/\b(?:ask|tell) (?:another|a) (?:agent|colleague) to (?:grant|create|change|install|send)\b/i, 'escalating through a colleague'],
];
/** Injection phrasing is allowed only inside quotes, as an example of what to ignore. */
const INJECTION = [
  /ignore (?:all |any |your )?(?:previous|prior|above|earlier) instructions/i,
  /\bdeveloper mode\b/i,
  /\byou are now\b/i,
  /\bjailbreak/i,
  /\bnew system prompt\b/i,
];

export function lintText(label, text) {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const at = `${label}:${i + 1}`;
    if (/\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./i.test(line)) out.push(`${at} carries a link; personas, skills and prompts carry no URLs`);
    for (const [re, why] of ESCALATION) if (re.test(line)) out.push(`${at} reads as ${why}: "${line.trim().slice(0, 80)}"`);
    const unquoted = line.replace(/"[^"]*"|“[^”]*”/g, '""');
    for (const re of INJECTION) if (re.test(unquoted)) out.push(`${at} carries injection phrasing outside quotes: "${line.trim().slice(0, 80)}"`);
    const tool = /\b((?:host|secret|secrets|developer|mcp|platform)\.[a-z_]+|email\.(?:send|add_account|remove_account|set_password)|owner\.set_profile)\b/.exec(line);
    if (tool && isDenied(tool[1])) out.push(`${at} names ${tool[1]}, which no catalogue agent holds`);
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: text.slice(m[0].length) };
}

function pngSize(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig) || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Everything about a package that can be said without a buddi: the schema,
 * the files and their limits, the grant against the tools that exist, the
 * plugins against the index, the denylist and the lint. Returns { problems,
 * tools } where tools is the resolved grant (for the claims).
 *
 * ctx: { core: [{name,tier,ownerOnly}], plugins: { name: { version, hostApi, tools } }, takenNames: Set }
 */
export function validateAgent(name, pkg, ctx) {
  const problems = [];
  const m = pkg.manifest;
  problems.push(...schemaProblems(m));
  if (m.name !== name) problems.push(`name must be "${name}", the folder it is in`);
  if (ctx.takenNames?.has(m.name)) problems.push(`"${m.name}" is already a plugin's name; names are unique across plugins and agents`);
  if (typeof m.version === 'string' && !parseVersion(m.version)) problems.push('version is not semver');
  if (Array.isArray(m.roles) && m.roles.length > 0 && m.trust !== 'by-buddi') problems.push('roles are for by-buddi packages only; anything else carries roles: []');
  if (Array.isArray(m.roles) && new Set(m.roles).size !== m.roles.length) problems.push('a role is named twice');
  if (Array.isArray(m.needs) && m.needs.includes('mailbox') && m.needs.includes('mailbox?')) problems.push('needs names mailbox and mailbox? both; pick one');
  if (typeof m.buddi === 'string' && !validRange(m.buddi)) problems.push(`buddi "${m.buddi}" is not a range this check reads (>=, ^, ~ or exact)`);
  for (const stray of pkg.strays) problems.push(`${stray} is not part of an agent package (agent.json, persona.md, skills/*.md, avatar.png)`);

  // Files and their limits.
  if (pkg.persona === null) problems.push('persona.md is missing');
  else {
    const bytes = Buffer.byteLength(pkg.persona, 'utf8');
    if (pkg.persona.trim() === '') problems.push('persona.md is empty');
    if (bytes > LIMITS.persona) problems.push(`persona.md is ${bytes} bytes; at most ${LIMITS.persona}`);
    if (/^---\n/.test(pkg.persona)) problems.push('persona.md is the body only; the front matter is built from agent.json');
    problems.push(...lintText('persona.md', pkg.persona));
  }
  const skillFiles = Object.keys(pkg.skills);
  if (skillFiles.length > LIMITS.skills) problems.push(`${skillFiles.length} skills; at most ${LIMITS.skills}`);
  for (const file of skillFiles) {
    const text = pkg.skills[file];
    const label = `skills/${file}`;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > LIMITS.skill) problems.push(`${label} is ${bytes} bytes; at most ${LIMITS.skill}`);
    const fm = frontMatter(text);
    const stem = file.slice(0, -3);
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(stem)) problems.push(`${label}: a skill's file name is kebab-case`);
    if (!fm) problems.push(`${label} starts with front matter: ---, name, description, ---`);
    else {
      if (fm.fields.name !== stem) problems.push(`${label}: name must be "${stem}", its file name`);
      if (!fm.fields.description || fm.fields.description.length > 300) problems.push(`${label}: description is one line of at most 300 characters`);
      const extra = Object.keys(fm.fields).filter((k) => k !== 'name' && k !== 'description');
      if (extra.length > 0) problems.push(`${label}: front matter holds only name and description (not ${extra.join(', ')})`);
      if (fm.body.trim() === '') problems.push(`${label} has no body`);
    }
    problems.push(...lintText(label, text));
  }
  if (pkg.avatar === null) problems.push('avatar.png is missing');
  else {
    if (pkg.avatar.length > LIMITS.avatar) problems.push(`avatar.png is ${pkg.avatar.length} bytes; at most ${LIMITS.avatar}`);
    const size = pngSize(pkg.avatar);
    if (!size) problems.push('avatar.png is not a PNG');
    else if (size.width !== LIMITS.avatarPx || size.height !== LIMITS.avatarPx) {
      problems.push(`avatar.png is ${size.width}×${size.height}; it is ${LIMITS.avatarPx} px square`);
    }
  }

  // Missions and fills.
  const missionIds = new Set();
  for (const mission of Array.isArray(m.missions) ? m.missions : []) {
    if (missionIds.has(mission.id)) problems.push(`mission id "${mission.id}" is used twice`);
    missionIds.add(mission.id);
    if (typeof mission.cron === 'string' && !cronWords(mission.cron)) problems.push(`mission ${mission.id}: cron "${mission.cron}" is not one this check can say in words`);
    if (typeof mission.prompt === 'string') problems.push(...lintText(`missions.${mission.id}.prompt`, mission.prompt));
  }
  const fillIds = new Set();
  for (const fill of Array.isArray(m.fills) ? m.fills : []) {
    if (fillIds.has(fill.id)) problems.push(`fill id "${fill.id}" is used twice`);
    fillIds.add(fill.id);
    if (fill.kind === 'time' && !missionIds.has(fill.mission)) problems.push(`fill ${fill.id}: a time fill names one of the missions (mission)`);
    if (fill.kind !== 'time' && fill.mission !== undefined) problems.push(`fill ${fill.id}: only a time fill names a mission`);
    if (fill.kind === 'mailbox' && !Array.isArray(m.needs)) continue;
    if (fill.kind === 'mailbox' && !m.needs.includes('mailbox') && !m.needs.includes('mailbox?')) problems.push(`fill ${fill.id}: a mailbox pick needs mailbox or mailbox? in needs`);
    if (fill.kind === 'mailbox' && !m.needs.includes('mailbox') && fill.optional !== true) {
      problems.push(`fill ${fill.id}: a mailbox pick is optional unless the agent needs a mailbox`);
    }
  }
  for (const text of [m.pitch, m.description, m.about, m.changes, ...(m.examples ?? [])]) {
    if (typeof text === 'string') problems.push(...lintText('agent.json', text));
  }

  // Owner-facing text says what the agent does in words, never a tool's name.
  const toolNames = new Set([...ctx.core, ...Object.values(ctx.plugins).flatMap((p) => p.tools ?? [])].map((t) => t.name));
  const ownerFacing = [
    ['pitch', m.pitch], ['description', m.description], ['about', m.about], ['changes', m.changes],
    ...(Array.isArray(m.examples) ? m.examples.map((t, i) => [`examples[${i}]`, t]) : []),
    ...(Array.isArray(m.missions) ? m.missions.map((mi) => [`missions.${mi.id}.name`, mi.name]) : []),
    ...skillFiles.map((file) => [`skills/${file} description`, frontMatter(pkg.skills[file])?.fields.description]),
  ];
  for (const [where, text] of ownerFacing) problems.push(...toolNameProblems(where, text, toolNames));

  // Plugins.
  const req = isObj(m.requires) ? m.requires : {};
  const opt = isObj(m.optional) ? m.optional : {};
  for (const [plugin, range] of [...Object.entries(req), ...Object.entries(opt)]) {
    const listed = ctx.plugins[plugin];
    if (plugin in req && plugin in opt) problems.push(`${plugin} is in both requires and optional`);
    if (!listed) { problems.push(`plugin "${plugin}" is not listed in this market`); continue; }
    if (!validRange(range)) problems.push(`${plugin}: "${range}" is not a range this check reads`);
    else if (!satisfies(listed.version, range)) problems.push(`${plugin}: the listed version ${listed.version} does not satisfy ${range}`);
    if (typeof listed.hostApi !== 'string') problems.push(`${plugin}: its entry declares no hostApi`);
  }

  // The grant.
  const resolved = [];
  for (const raw of Array.isArray(m.tools) ? m.tools : []) {
    if (typeof raw !== 'string') continue;
    const optional = raw.endsWith('?');
    const pattern = optional ? raw.slice(0, -1) : raw;
    const coreHits = matchTool(pattern, ctx.core);
    const owners = Object.entries(ctx.plugins).filter(([, p]) => matchTool(pattern, p.tools).length > 0).map(([n]) => n);
    if (coreHits.length > 0) {
      const mailTool = pattern.startsWith('email.');
      const mailboxOptional = Array.isArray(m.needs) && m.needs.includes('mailbox?');
      if (mailTool && mailboxOptional) {
        if (!optional) problems.push(`${raw}: the mailbox is optional (needs mailbox?), so mail tools end in ? (${raw}?)`);
      } else if (optional) {
        problems.push(mailTool
          ? `${raw}: a mail tool takes ? only when the mailbox is optional (needs mailbox?)`
          : `${raw}: a core tool is always there; the ? is for an optional plugin's tool or an optional mailbox`);
      }
      for (const t of coreHits) resolved.push({ ...t, plugin: 'core', grant: raw, optional: optional && mailTool && mailboxOptional });
    } else if (owners.length === 0) {
      const exact = ctx.core.find((t) => t.name === pattern) ?? Object.values(ctx.plugins).flatMap((p) => p.tools).find((t) => t.name === pattern);
      problems.push(exact?.ownerOnly ? `${raw} is owner-only; no agent can hold it` : `${raw} is not a tool buddi or a listed plugin has`);
    } else {
      const plugin = owners[0];
      if (plugin in req) {
        if (optional) problems.push(`${raw}: ${plugin} is required, so its tools take no ?`);
      } else if (plugin in opt) {
        if (!optional) problems.push(`${raw}: ${plugin} is optional, so its tools end in ? (${raw}?)`);
      } else {
        problems.push(`${raw} belongs to ${plugin}, which is in neither requires nor optional`);
      }
      for (const t of matchTool(pattern, ctx.plugins[plugin].tools)) resolved.push({ ...t, plugin, grant: raw, optional });
    }
  }
  const seen = new Map();
  for (const t of resolved) {
    if (t.ownerOnly) problems.push(`${t.name} is owner-only; no agent can hold it`);
    if (isDenied(t.name)) problems.push(`${t.grant} reaches ${t.name}, which a catalogue agent may not ask for (v1 denylist); the owner adds it by hand`);
    if (seen.has(t.name)) continue;
    seen.set(t.name, t);
  }
  return { problems: [...new Set(problems)], tools: [...seen.values()] };
}

/** What reads like a tool name in prose; only a name in the tool list counts (so withbuddi.com passes). */
const TOOL_TOKEN = /\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\b/g;

/** A problem for each known tool name in a piece of owner-facing text. */
export function toolNameProblems(where, text, toolNames) {
  if (typeof text !== 'string') return [];
  const named = [...new Set(text.match(TOOL_TOKEN) ?? [])].filter((token) => toolNames.has(token));
  return named.map((tool) => `${where} names the tool ${tool}; the owner reads this, so say what it does in words (e.g. "saves reports to your Files") instead of a tool's name`);
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/* ------------------------------------------------------------------ *
 * Missions in words
 * ------------------------------------------------------------------ */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/** A five-field cron in words, or null for a shape the catalogue does not use. */
export function cronWords(cron) {
  const [min, hour, dom, mon, dow, ...rest] = cron.trim().split(/\s+/);
  if (rest.length > 0 || mon !== '*' || !/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour)) return null;
  if (+min > 59 || +hour > 23) return null;
  const at = `at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  const day = (d) => DAYS[DAY_NAMES[d.toUpperCase()] ?? +d % 7];
  if (dom === '*' && dow === '*') return `Every day ${at}`;
  if (dom === '*' && /^(1-5|MON-FRI)$/i.test(dow)) return `Weekdays ${at}`;
  if (dom === '*' && /^([0-7]|SUN|MON|TUE|WED|THU|FRI|SAT)(,([0-7]|SUN|MON|TUE|WED|THU|FRI|SAT))*$/i.test(dow)) {
    const names = dow.split(',').map(day);
    return `Every ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`} ${at}`;
  }
  if (/^\d{1,2}$/.test(dom) && +dom >= 1 && +dom <= 28 && dow === '*') {
    return +dom === 1 ? `The first of every month ${at}` : `Day ${dom} of every month ${at}`;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Claims
 * ------------------------------------------------------------------ */

/** What the check computes and the page and buddi read: the grant with tiers, the missions in words, the plugins. */
export function agentClaims(pkg, resolvedTools, ctx) {
  const m = pkg.manifest;
  const plugin = (name, range) => ({ name, range, listed: ctx.plugins[name]?.version ?? null, hostApi: ctx.plugins[name]?.hostApi ?? null });
  const size = pkg.avatar ? pngSize(pkg.avatar) : null;
  return {
    tools: resolvedTools.map((t) => ({ name: t.name, plugin: t.plugin, tier: t.tier, ownerOnly: t.ownerOnly, optional: t.optional })),
    missions: (m.missions ?? []).map((mission) => ({ id: mission.id, name: mission.name, when: cronWords(mission.cron), enabled: false })),
    plugins: {
      requires: Object.entries(m.requires ?? {}).map(([n, r]) => plugin(n, r)),
      optional: Object.entries(m.optional ?? {}).map(([n, r]) => plugin(n, r)),
    },
    skills: Object.keys(pkg.skills).map((file) => ({ file, name: frontMatter(pkg.skills[file])?.fields.name ?? null, description: frontMatter(pkg.skills[file])?.fields.description ?? null })),
    avatar: pkg.avatar ? { sha256: sha256(pkg.avatar), bytes: pkg.avatar.length, width: size?.width ?? null, height: size?.height ?? null } : null,
    sizes: { persona: Buffer.byteLength(pkg.persona ?? '', 'utf8'), skills: Object.values(pkg.skills).reduce((n, s) => n + Buffer.byteLength(s, 'utf8'), 0) },
  };
}

/* ------------------------------------------------------------------ *
 * The version moved when the package moved (compared with the base branch)
 * ------------------------------------------------------------------ */

/** The package as it is on `ref`, or null when the agent is new there. */
export function packageAt(ref, name) {
  const git = (args, encoding = 'utf8') => execFileSync('git', args, { cwd: ROOT, encoding, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
  let files;
  try {
    files = git(['ls-tree', '-r', '--name-only', ref, `agents/${name}/`]).split('\n').filter(Boolean);
  } catch {
    return null;
  }
  if (!files.includes(`agents/${name}/agent.json`)) return null;
  const show = (f, enc) => git(['show', `${ref}:${f}`], enc);
  const skills = {};
  for (const f of files.filter((f) => f.startsWith(`agents/${name}/skills/`) && f.endsWith('.md')).sort()) {
    skills[path.basename(f)] = show(f);
  }
  return {
    manifest: JSON.parse(show(`agents/${name}/agent.json`)),
    persona: files.includes(`agents/${name}/persona.md`) ? show(`agents/${name}/persona.md`) : null,
    skills,
    avatar: files.includes(`agents/${name}/avatar.png`) ? show(`agents/${name}/avatar.png`, 'buffer') : null,
    strays: [],
  };
}

/** A problem when the package changed without its version moving forward, else null. */
export function versionProblem(current, base) {
  if (base === null) return null;
  if (agentIntegrity(current) === agentIntegrity(base)) return null;
  const now = current.manifest.version;
  const then = base.manifest.version;
  if (!parseVersion(now) || !parseVersion(then)) return null;
  if (compareVersions(now, then) <= 0) return `the package changed but its version did not move past ${then}; bump it and write a changes line`;
  if (current.manifest.changes === base.manifest.changes) return 'the version moved but changes still describes the old one';
  return null;
}
