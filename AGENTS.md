# For coding agents

Read `../buddi-planning/HANDBOOK.md` first: repositories, the two buddi
instances on this Mac, the dev loop, tests, reviews, releases and the
standing rules. Then `../buddi-planning/ROADMAP.md` for what is next.

## This repo
- `node scripts/check.mjs --write <name>` after a plugin or agent publish, then `node scripts/check.mjs`; use `BUDDI_BIN=$(which buddi-dev)` after a host API bump.
- Merging to main rebuilds withbuddi.com. Entries only for versions already on npm with provenance.
