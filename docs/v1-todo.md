# What's left to ship v1

The site, validation, design system, pipeline, and import tooling are all built and verified (see the plan at implementation time for details). Nothing below is broken — this is what still needs Rob's input or a live environment before the site is real and public.

## Content

- [ ] Write the three real hand-written entries (`CLAUDE.md`: "Rob will write three real ones by hand before any generated entry ships; treat those three as the standard, not this template").
- [ ] Delete the three placeholder entries once the real ones exist: [2026-fake-example-one.md](../src/content/entries/2026-fake-example-one.md), [2026-fake-example-two.md](../src/content/entries/2026-fake-example-two.md), [2026-fake-example-three.md](../src/content/entries/2026-fake-example-three.md) — each is marked `FAKE PLACEHOLDER ENTRY` in its frontmatter comment.
- [ ] Drop `STYLE.md` into `docs/planning/` (referenced by `CLAUDE.md` but not yet written). The homepage intro sentence in [index.astro](../src/pages/index.astro) is now Rob's own copy rather than an assistant placeholder, but hasn't been checked against a house style that doesn't exist yet.
- [ ] The 9 real papers from `example-papers.md` are `status: published` and live on the site. Each still has `## Why it matters` deliberately blank — that's the one opinionated line on the page, worth writing per entry when there's a genuine take, rather than leaving all 9 silent indefinitely.
- [ ] `2605.01472` ("Adaptive Memory in Conversational UX" from `example-papers.md`) doesn't check out — that arXiv ID resolves to an unrelated physics paper, and no matching title exists anywhere on arXiv. Track down the real ID or drop it from the source list.

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

- [x] In the GitHub repo settings, set Pages source to "GitHub Actions" (required for [deploy.yml](../.github/workflows/deploy.yml) to publish).
- [x] Push to `main` and confirm the deploy workflow goes green and the site is reachable at `https://oiai-studio.github.io/Marginalia/`.
- [ ] If a custom domain is wanted instead of the default GitHub Pages URL, update `site`/`base` in [astro.config.mjs](../astro.config.mjs) and add a `CNAME`.

## Housekeeping

- [x] First commit and push — done.
- [ ] Confirm `npm ci && npm run build` goes green in CI on a real PR (only run on direct pushes to `main` so far, via the deploy workflow — no PR has been opened yet).
- [ ] Approve or ignore the `esbuild`/`sharp` install-script warnings npm prints on install (both are legitimate Astro build dependencies, not something this project added).

## Future feature ideas (post-v1, to discuss)

Rob's notes from using the live site — none of these are scoped or agreed yet, just captured so we don't lose them before talking through the approach.

- **Curation by industry.** A second axis alongside theme/tags: group or flag papers by industry vertical — pharma B2B, banking B2C, and so on — reflecting an actual opinion on which papers matter to which industries, not just an extracted fact. Open questions to work through: is this a closed vocabulary like theme, or looser like tags; does one paper get one industry or several; does it get its own checklist/route on the homepage the way themes do, or live purely as a filter.
- **Personal shortlist.** Let a reader tick papers as they browse, then jump to a second page listing just their picks, with a way to take them away — download, or copy out as a markdown block formatted for pasting into an LLM. Would run entirely on browser-local storage, no accounts or server, which fits the "no accounts" non-goal. Needs client-side JavaScript to persist ticks and render the filtered picks page — fine per the updated rule in `CLAUDE.md`/`DESIGN.md` (no framework, no app infrastructure, but a small scoped script for a specific feature is allowed).
- **More sorting controls.** Beyond the current fixed "published date, newest first," let readers reorder by things like model tested or institution. Could be pre-rendered as static routes for a small fixed set of orders (no JS needed, same pattern as theme/tag pages), or a small client-side script for fully open sorting — either is fine now.

`CLAUDE.md`/`DESIGN.md` were updated (2026-08-09) to clarify the JS rule: no framework, no app infrastructure, but a small framework-free script scoped to one feature is fine when it earns its place. That was already the intent behind "no JavaScript framework" — `DESIGN.md`'s "no JavaScript ships to the browser at all" line had over-applied it into a hard zero-JS rule.

## Known, deliberate gaps (not blockers, just don't forget why)

- DESIGN.md's `[DATED]` flag for old models tested isn't built — it needs a model-release-date lookup that isn't part of the content model, and wasn't in the agreed v1 scope.
- CI will fail on the placeholder entries' fake URLs until they're replaced with the real three — that's the link-checker working as intended, not a bug.
