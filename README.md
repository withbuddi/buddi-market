# buddi-market

The index behind [withbuddi.com/plugins](https://withbuddi.com/plugins), and
what buddi's Browse tab and agent catalogue read. One directory per listed
plugin, and one per catalogue agent (see [Agents](#agents)):

```
plugins/<name>/entry.json    the listing: npm name, version, category, trust, price
plugins/<name>/icon.svg      its icon on the market (40 and 64 px; never inside buddi)
plugins/<name>/shots/*.webp  screenshots, 1440 px wide at most
```

The site builds from this repository and publishes each page and
`plugins/index.json`, where each plugin carries its `widgets` beside the
entry (the same list as in its claims). buddi fetches that file when the owner opens Browse,
and installs from npm exactly as it always has: the package is staged, hashed
and read, and the owner approves it. The market changes nothing about that.

## Submitting a plugin

Publish it to npm under your own name, with provenance if you can
(`npm publish --provenance` from a public repository). Then open a pull
request here that adds `plugins/<name>/entry.json`, written by hand, with
only these fields:

```json
{
  "name": "tides",
  "npm": "@you/buddi-plugin-tides",
  "version": "1.0.0",
  "title": "Tides",
  "summary": "High and low water for the harbours you save. Two sentences at most.",
  "category": "days",
  "trust": "reviewed",
  "pricing": { "kind": "free" },
  "icon": "icon.svg",
  "screenshots": ["shots/week.webp"],
  "author": { "name": "You", "url": "https://you.example" },
  "license": "MIT",
  "repository": "https://github.com/you/buddi-plugin-tides",
  "hostApi": "^1.10"
}
```

`category` is one of `days`, `money`, `home`, `voice`, `work`, `other`.
`pricing.kind` is `free`, `paid` or `subscription`; a paid one names its
`vendor` page and may say `trialDays`. `trust` is `reviewed` for anything not
published from a withbuddi repository.

Then run the check, which writes the rest of the entry:

```sh
npm install -g @withbuddi/buddi
node scripts/check.mjs --write tides
```

It asks npm for the version, reads its provenance, and runs
`buddi plugins describe`, which stages the package the way an install would
and reads its manifest. What it writes (`claims`, `integrity`, `provenance`) is what the page shows: the tools and their tiers, the schema,
the hosts, what runs on a timer, the agents it proposes, and the widgets it
brings (`claims.manifest.widgets`: each one's id, title, sizes, settings, and
the sample body per size the widget declares as `preview`, which the site and
buddi's Browse draw on the listing and on their Widgets shelf). A plugin that
is only a widget is welcome; give it a `preview` so its listing has something
to show. The page can never
claim less than the code does, because the page is written from the code. The
same check runs on the pull request and fails when the committed block is not
what it computes.

Merging is the review. For a third party's plugin the entry records the
version that was read and what the reading covered (`reviewed`), and the
listing says so. A new version is a pull request that bumps `version` and
re-runs the check.

## Trust, as shown

- **By buddi**: published from a withbuddi repository by its workflow; the
  provenance on npm says so and the check verifies it.
- **Reviewed**: someone else's; a named version was read before it was listed,
  and the entry says what the reading covered.
- Anything not here is **unlisted** inside buddi: it still installs, with the
  same staged card, and the card says nobody has read it.

## Agents

The teammates in buddi's catalogue. An agent is configuration, never code: a
persona, the tools it asks for, the plugins it needs, suggested missions (they
arrive off) and three example asks. One folder each:

```
agents/<name>/agent.json     the manifest (schemas/agent.schema.json)
agents/<name>/persona.md     the persona: the body of the agent file
agents/<name>/skills/*.md    text skills, front matter name + description (optional)
agents/<name>/avatar.png     512 px square PNG, 200 KB at most, from the buddi-design kit
```

`category` is one of `work`, `money`, `home`, `health`, `learning`, `life`.
`tools` is the grant, tool by tool or by family (`memory.*`); a tool ending in
`?` belongs to a plugin in `optional` and holds only while it is installed.
`requires` and `optional` name listed plugins with semver ranges. Missions
are created off. `fills` are the picks the install sheet asks (`mailbox`,
`calendar`, `place`, `time` for a mission's hour, `text`). The persona never
names the owner, their timezone or their places: buddi tells every agent those
on every turn.

`needs` names what is not a plugin: `mailbox`, `image-account`, or `mailbox?`
for a mailbox that makes it better, whose `email.*` tools then end in `?`.
`roles` (the capabilities plugin missions and watchers address) are for by-buddi
packages only.

`delegates` names catalogue agents it hands work to (with `agent.delegate` in
its tools); buddi resolves them at install to the agents installed there.

Not allowed: `model`, `provider`, `account`, `bundles`, and any unknown field.
Never grantable by a package: `host.*`, `secret.type`, `secrets.*`, `developer.*`, `mcp.*`, `platform.*` writes, `owner.set_profile`,
`email.send` and the mail account tools, and any owner-only tool. The owner can
add these by hand after install.

The check writes `integrity` (sha256 over the canonical package: the manifest
without `integrity` and `claims`, the persona, each skill and the avatar's
hash; `agentIntegrity` in `scripts/agents.mjs` is the definition buddi
mirrors) and `claims` (the resolved tools with tiers, the missions in words,
the plugins with their listed versions):

```sh
node scripts/check.mjs --write agent:chef
```

Any change to a package needs a new `version` and a new `changes` line; the
check compares with `main` and fails otherwise. Personas, skills and mission
prompts become system text, so the review is the gate, and a simple lint
refuses links, escalation ("without asking", "always allow") and injection
phrasing outside quotes.

**Submitting**: by-buddi only for now. Community agents come with community
review and the verified badge.

## Scripts

```sh
node scripts/check.mjs [--write] [name...]   # the check; no names = every entry
node scripts/check.mjs [--write] agent:<name> # one agent; --agents for all of them
node scripts/index.mjs [out.json] [origin]   # everything as one document
node --test scripts/agents.test.mjs          # the agent check's own tests
```

All need Node 22. The plugin check needs `buddi` on the PATH, or `BUDDI_BIN`.
The agent check asks `buddi tools list --core --json` for the tools buddi has
and falls back to `scripts/core-tools.json`, a snapshot of a named release.
