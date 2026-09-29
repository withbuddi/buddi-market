# buddi-market

The index behind [withbuddi.com/plugins](https://withbuddi.com/plugins), and
what buddi's Browse tab reads. One directory per listed plugin:

```
plugins/<name>/entry.json    the listing: npm name, version, category, trust, price
plugins/<name>/icon.svg      its icon on the market (40 and 64 px; never inside buddi)
plugins/<name>/shots/*.webp  screenshots, 1440 px wide at most
```

The site builds from this repository and publishes each page and
`plugins/index.json`. buddi fetches that file when the owner opens Browse,
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
the hosts, what runs on a timer, the agents it proposes. The page can never
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

## Scripts

```sh
node scripts/check.mjs [--write] [name...]   # the check; no names = every entry
node scripts/index.mjs [out.json] [origin]   # everything as one document
```

Both need Node 22. `check.mjs` needs `buddi` on the PATH, or `BUDDI_BIN`.
