# What's left to ship v1

The site, validation, design system, pipeline, and import tooling are all built and verified (see the plan at implementation time for details). Nothing below is broken — this is what still needs Rob's input or a live environment before the site is real and public.

## Content

- [x] Write the three real hand-written entries (`CLAUDE.md`: "Rob will write three real ones by hand before any generated entry ships; treat those three as the standard, not this template").
- [ ] Delete the three placeholder entries once the real ones exist: [2026-fake-example-one.md](../src/content/entries/2026-fake-example-one.md), [2026-fake-example-two.md](../src/content/entries/2026-fake-example-two.md), [2026-fake-example-three.md](../src/content/entries/2026-fake-example-three.md) — each is marked `FAKE PLACEHOLDER ENTRY` in its frontmatter comment.
- [x] Drop `STYLE.md` into `docs/planning/` — done. It's two guides in one file: general prose rules (applies to every summary on the site) and a full SaaS UI copy guide written for a different product ("Antivo" — buttons, forms, workspaces). The second half doesn't apply here; Marginalia has no interactive UI to write copy for.
- [x] `## Why it matters` is gone entirely (2026-08-10) — not just left blank, removed as a concept. `CONTENT-MODEL.md` now specs one body field only (`## What they found`); the extraction prompt, `write-entries.mjs`, and all 12 entry files were updated to match. `validate-entries.mjs` now fails the build on any stray section beyond "What they found", so it can't quietly creep back in.
- [x] `2605.01472` ("Adaptive Memory in Conversational UX") — resolved 2026-08-10: no real paper by this title exists anywhere on arXiv under any ID, after a thorough search. Looks like a fabricated lead from the original ChatGPT-sourced list. Dropped from `example-papers.md` (commented out with a note) rather than force a substitute match.



## Pipeline

- [x] Pick an LLM provider — DeepSeek. `callModel()` in [extract.mjs](../scripts/lib/extract.mjs) now calls DeepSeek's chat completions API live, reading `DEEPSEEK_API_KEY` from the environment.
- [x] Add `DEEPSEEK_API_KEY` as a GitHub Actions secret — done. Confirmed live 2026-08-10: a real `workflow_dispatch` run queried arXiv/Crossref, called DeepSeek for real, wrote 19 valid entries, and correctly skipped 6 for bad theme/tag values.
- [x] Two org-level GitHub settings also needed changing before the pipeline could open its own PR — both now done: **Actions permissions** (`default_workflow_permissions: write`, `can_approve_pull_request_reviews: true`, at `github.com/organizations/oiai-studio/settings/actions`), and a separate **first-run approval gate** that blocked `ci.yml` from even starting on the bot-authored PR branch until manually approved once (`gh api .../actions/runs/<id>/approve`). Worth knowing about if a future PR from the pipeline sits stuck without CI ever starting.
- [x] Broadened and fixed the search itself (2026-08-10, prompted by tips from Rob's other ChatGPT paper-tracking conversation — see the "Deferred: scored/ranked retrieval" idea below for the parts of that advice not adopted). Concretely: arXiv categories went from 3 to 6 (`cs.HC`, `cs.AI`, `cs.CL`, `cs.LG`, `cs.CY`, `cs.IR`); Crossref venues went from 2 to 8 (added UIST, CSCW, DIS, HRI, IMWUT, CHI PLAY); the arXiv query now requires an AI-concept term **and** a UX-concept term (except `cs.HC`, which doesn't need the second) instead of one flat OR list, using arXiv's native boolean query syntax — no scoring system needed for it. Also fixed two real bugs found while doing this: the IUI venue query was hardcoded to a specific old edition's title (silently ageing badly), and `queryContainer()` was combining `sort=published` with a relevance query, which silently discarded Crossref's ranking entirely (verified live — see `fetch-crossref.mjs`'s comment for the exact repro). Retrieval/processing caps bumped from 25 to 40 based on real evidence (first live run found 388 candidates, processed a blind first-25).
- [ ] Confirm the weekly ingest time — [ingest.yml](../.github/workflows/ingest.yml) currently defaults to Monday 07:00 UTC.
- [ ] Decide how `data/rejected.txt` gets populated day to day — nothing automates this yet; it's a plain text file, one ID per line, appended by hand.
- [x] The ingest workflow has now run for real (PR #1) — `npm run ready` is the way to see what's queued before flipping any to `published`.



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
- [x] `npm ci && npm run build` has now run on a real PR (`ci.yml` fired on PR #1, the pipeline's first live output) — and correctly failed on real content violations (6 findings over the 40-word cap), proving the gate actually works, not just that it's wired.
- [x] Resolved the `esbuild`/`sharp` install-script warnings via `npm approve-scripts` (npm's own built-in feature) — both are legitimate Astro/Vite build dependencies.



## Future feature ideas (post-v1, to discuss)

Rob's notes from using the live site — none of these are scoped or agreed yet, just captured so we don't lose them before talking through the approach.

- **Curation by industry.** A second axis alongside theme/tags: group or flag papers by industry vertical — pharma B2B, banking B2C, and so on — reflecting an actual opinion on which papers matter to which industries, not just an extracted fact. Open questions to work through: is this a closed vocabulary like theme, or looser like tags; does one paper get one industry or several; does it get its own checklist/route on the homepage the way themes do, or live purely as a filter.
- **Personal shortlist.** Let a reader tick papers as they browse, then jump to a second page listing just their picks, with a way to take them away — download, or copy out as a markdown block formatted for pasting into an LLM. Would run entirely on browser-local storage, no accounts or server, which fits the "no accounts" non-goal. Needs client-side JavaScript to persist ticks and render the filtered picks page — fine per the updated rule in `CLAUDE.md`/`DESIGN.md` (no framework, no app infrastructure, but a small scoped script for a specific feature is allowed).
- **More sorting controls.** Beyond the current fixed "published date, newest first," let readers reorder by things like model tested or institution. Could be pre-rendered as static routes for a small fixed set of orders (no JS needed, same pattern as theme/tag pages), or a small client-side script for fully open sorting — either is fine now.
- **Scored/ranked retrieval, semantic judging, and a weekly digest** (2026-08-10, from tips Rob's other ChatGPT paper-tracking conversation gave on the pipeline's search). The good, low-risk parts of that advice are already built (see the Pipeline section above: broader categories/venues, AND-query precision, two real bug fixes). Deliberately **not** built yet, and worth deciding on rather than absorbing wholesale:
  - A deterministic scoring function (weighted keyword-group matches, category weights, method-term boosts, negative-term penalties) to rank candidates before capping, instead of the current "first N by date."
  - A second LLM pass that batch-judges the top ~40 candidates against an explicit relevance rubric before the per-paper extraction step runs.
  - Thematic clustering and a synthesised weekly digest ("3 papers concern agent supervision...") in the PR body, beyond the current title/theme/N/study-type table.
  - Why not yet: `PIPELINE.md`'s actual design premise is "the machine collects broadly and cheaply, the human judges" — over-collecting on purpose and putting all editorial judgment in Rob's PR review, which is deliberately kept cheap and low-stakes. Moving relevance judgment into an algorithm is a legitimate direction, but it's a different pipeline, not a bug fix, and the specific numeric weights ChatGPT proposed (`ai*3 + ux*4...`, `hciRelevance*0.30 + ...`) were invented on the spot, not calibrated against anything real. Worth scoping properly if Rob wants it, not built on the strength of a suggestion alone.

`CLAUDE.md`/`DESIGN.md` were updated (2026-08-09) to clarify the JS rule: no framework, no app infrastructure, but a small framework-free script scoped to one feature is fine when it earns its place. That was already the intent behind "no JavaScript framework" — `DESIGN.md`'s "no JavaScript ships to the browser at all" line had over-applied it into a hard zero-JS rule.

## Known, deliberate gaps (not blockers, just don't forget why)

- DESIGN.md's `[DATED]` flag for old models tested isn't built — it needs a model-release-date lookup that isn't part of the content model, and wasn't in the agreed v1 scope.
- CI will fail on the placeholder entries' fake URLs until they're replaced with the real three — that's the link-checker working as intended, not a bug.

