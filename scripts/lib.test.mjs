// The widgets a listing carries: what the check records from `buddi plugins
// describe`, what it refuses, and what the index publishes for Browse and the
// site's Widgets filter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT, listEntries, readEntry, widgetProblems, widgetsOf, withClaims } from './lib.mjs';

const weatherNow = {
  id: 'weather.now',
  title: 'Weather',
  sizes: ['small', 'medium'],
  settings: [{ key: 'place', kind: 'select', label: 'Place' }],
  preview: { small: { kind: 'stat', value: '18°C' }, medium: { kind: 'strip', items: [{ label: '15:00', value: '21°' }] } },
};

test('the check records the widgets describe read, beside the tools', () => {
  const entry = { name: 'weather', npm: '@withbuddi/plugin-weather', version: '0.1.5' };
  const described = { package: { integrity: 'sha512-x', name: '@withbuddi/plugin-weather' }, claims: {}, manifest: { tools: [], widgets: [weatherNow] }, drift: [] };
  const next = withClaims(entry, described, {}, null);
  assert.deepEqual(widgetsOf(next), [weatherNow]);
  assert.deepEqual(widgetProblems('weather', widgetsOf(next)), []);
});

test('an entry checked before widgets were described has none', () => {
  assert.deepEqual(widgetsOf({ claims: { manifest: { tools: [] } } }), []);
  assert.deepEqual(widgetsOf({}), []);
});

test('refuses widgets that are not what a listing may draw', () => {
  const problems = widgetProblems('weather', [
    { ...weatherNow, id: 'other.now' },
    { ...weatherNow, id: 'weather.big', sizes: ['large'], preview: undefined },
    { ...weatherNow, id: 'weather.prev', sizes: ['small'], preview: { medium: { kind: 'text', text: 'x' } } },
    { ...weatherNow, id: 'weather.body', preview: { small: { text: 'no kind' } } },
    { ...weatherNow, id: 'weather.set', settings: [{ key: 'x' }] },
    { ...weatherNow, id: 'weather.untitled', title: '' },
  ]);
  assert.equal(problems.length, 6);
  assert.match(problems[0], /must be named weather\.<name>/);
  assert.match(problems[1], /sizes must list small and\/or medium/);
  assert.match(problems[2], /preview for medium, which it does not offer/);
  assert.match(problems[3], /the small preview is not a body/);
  assert.match(problems[4], /settings must be a list/);
  assert.match(problems[5], /title must be 1 to 40/);
  assert.deepEqual(widgetProblems('weather', 'nope'), ['claims.manifest.widgets must be a list']);
});

test('the index gives every plugin its widgets, from its claims', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'market-index-'));
  try {
    const out = path.join(dir, 'index.json');
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'index.mjs'), out], { stdio: 'pipe' });
    const index = JSON.parse(readFileSync(out, 'utf8'));
    for (const name of listEntries()) {
      const listed = index.plugins.find((p) => p.name === name);
      if (!listed) continue;
      assert.ok(Array.isArray(listed.widgets), `${name} carries widgets`);
      assert.deepEqual(listed.widgets, widgetsOf(readEntry(name)));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
