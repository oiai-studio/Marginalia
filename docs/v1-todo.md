# What's left to ship v1

The site, validation, design system, pipeline, and import tooling are all built and verified (see the plan at implementation time for details). Nothing below is broken — this is what still needs Rob's input or a live environment before the site is real and public.

## Content

- [ ] Write the three real hand-written entries (`CLAUDE.md`: "Rob will write three real ones by hand before any generated entry ships; treat those three as the standard, not this template").
- [ ] Delete the three placeholder entries once the real ones exist: [2026-fake-example-one.md](../src/content/entries/2026-fake-example-one.md), [2026-fake-example-two.md](../src/content/entries/2026-fake-example-two.md), [2026-fake-example-three.md](../src/content/entries/2026-fake-example-three.md) — each is marked `FAKE PLACEHOLDER ENTRY` in its frontmatter comment.
- [ ] Drop `STYLE.md` into `docs/planning/` (referenced by `CLAUDE.md` but not yet written). The homepage intro sentence in [index.astro](../src/pages/index.astro) is now Rob's own copy rather than an assistant placeholder, but hasn't been checked against a house style that doesn't exist yet.

## Pipeline

- [ ] Pick an LLM provider for the extraction step and wire it into `callModel()` in [extract.mjs](../scripts/lib/extract.mjs) — currently stubbed and throws `No LLM provider configured` for every candidate.
- [ ] Add the provider's API key as a GitHub Actions secret (`ingest.yml` already expects `ANTHROPIC_API_KEY`; rename if a different provider is chosen).
- [ ] Confirm the weekly ingest time — [ingest.yml](../.github/workflows/ingest.yml) currently defaults to Monday 07:00 UTC.
- [ ] Decide how `data/rejected.txt` gets populated day to day — nothing automates this yet; it's a plain text file, one ID per line, appended by hand.
- [ ] Once the ingest workflow has run for real, build `scripts/ready.mjs`'s output into a habit (`npm run ready` lists queued entries) before flipping any to `published`.

## Backlog import

- [ ] Export the ChatGPT paper-tracking conversation as CSV(s) per `IMPORT.md`'s three-column shape (`identifier,title,date_found`).
- [ ] Run `npm run import:backlog <file.csv...>` against the real export and sanity-check the resolution rate (warns below ~70%).
- [ ] Review `data/unresolved.csv` after that run and hand-resolve or discard each row.
- [ ] Pick the 15-20 backlog papers Rob already knows are good and list their IDs in `data/backlog-seed.txt`, then run `npm run import:seed` to fast-track them ahead of the weekly drain.

## Deployment

- [ ] In the GitHub repo settings, set Pages source to "GitHub Actions" (required for [deploy.yml](../.github/workflows/deploy.yml) to publish).
- [ ] Push to `main` and confirm the deploy workflow goes green and the site is reachable at `https://oiai-studio.github.io/Marginalia/`.
- [ ] If a custom domain is wanted instead of the default GitHub Pages URL, update `site`/`base` in [astro.config.mjs](../astro.config.mjs) and add a `CNAME`.

## Housekeeping

- [ ] First commit — nothing in the scaffold is committed to git yet.
- [ ] Confirm `npm ci && npm run build` goes green in CI on a real PR (only run locally so far).
- [ ] Approve or ignore the `esbuild`/`sharp` install-script warnings npm prints on install (both are legitimate Astro build dependencies, not something this project added).

## Known, deliberate gaps (not blockers, just don't forget why)

- DESIGN.md's `[DATED]` flag for old models tested isn't built — it needs a model-release-date lookup that isn't part of the content model, and wasn't in the agreed v1 scope.
- CI will fail on the placeholder entries' fake URLs until they're replaced with the real three — that's the link-checker working as intended, not a bug.
