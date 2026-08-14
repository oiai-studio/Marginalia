# Marginalia

HCI and AI papers, indexed by the design questions they answer and the evidence they actually rest on.

A public, static index of academic papers on human-AI interaction. Each entry is one paper, reduced to a handful of appraisal signals (who was tested, on which model, in what setting) plus a short summary, with a link out to the original. The site doesn't score or rate papers — the editorial act is choosing what goes in, nothing else.

Live at [`oiai-studio.github.io/Marginalia`](https://oiai-studio.github.io/Marginalia/).

## How a paper gets onto the site

Every entry goes through the same four stages, whether it arrived by the weekly automated search or by hand:

```
1. FIND        →  2. RESOLVE       →  3. EXTRACT        →  4. REVIEW
   a candidate     confirm it's a       an LLM reads         a human decides
   paper turns up  real paper, get      the full text and    what ships
                    its canonical ID    fills in the fields
```

**1. Find.** New candidates come from two places:
- The weekly ingest ([`ingest.yml`](.github/workflows/ingest.yml), currently paused — see [`docs/v1-todo.md`](docs/v1-todo.md)) queries arXiv and a set of HCI venues on Crossref automatically.
- Rob finds papers by hand (e.g. from a running ChatGPT conversation) and hands over a list of titles/identifiers.

**2. Resolve.** Every candidate is checked against the arXiv/Crossref APIs before anything is written — never taken on trust. A title recalled from a chat can be transposed, near-miss, or simply invented, so the resolver fuzzy-matches the claimed title against the real record and only proceeds on a strong match. Anything that doesn't resolve is dropped into [`data/unresolved.csv`](data/unresolved.csv) for a human to chase down or discard, never guessed at.

**3. Extract.** Only once a paper is confirmed real does an LLM (DeepSeek) read its full text and fill in a fixed set of fields — see [What the LLM does](#what-the-llm-does) below.

**4. Review.** The entry is written to [`src/content/entries/`](src/content/entries/) as a file with `status: queued`. Nothing queued is visible on the live site. A human reviews it, and either flips it to `status: published` or deletes the file.

## What the LLM does

The LLM's job is narrow on purpose: read one paper's full text and extract facts into a fixed schema (see [`docs/planning/CONTENT-MODEL.md`](docs/planning/CONTENT-MODEL.md)). It does not judge relevance, does not write opinions, and does not decide what ships.

Hard rules it follows (the full prompt is in [`docs/planning/PIPELINE.md`](docs/planning/PIPELINE.md)):

- **Extract only what the paper states.** No inferring, estimating, or filling gaps from outside knowledge. If a paper doesn't name the model it tested, the field says `not reported` — that's a correct answer, not a failure.
- **Never lift the abstract.** Every summary word is freshly written, in the site's plain house style (see [`docs/planning/STYLE.md`](docs/planning/STYLE.md)), capped at 40 words.
- **Closed vocabularies only.** Theme, tags, study type, and setting all come from fixed lists. A build-time check ([`scripts/validate-entries.mjs`](scripts/validate-entries.mjs)) fails hard on anything outside them, or over the word cap — so a bad extraction can't quietly reach the site.

## What the human does

Everything the LLM deliberately doesn't do:

- **Judges relevance.** The pipeline collects broadly on purpose — it's cheaper to over-collect and let a human skim a PR table than to build a scoring system nobody's calibrated. Reviewing the PR *is* the editorial step.
- **Publishes.** Editing `status: queued` → `status: published` and pushing is the only way an entry becomes visible. Nothing auto-publishes, ever.
- **Maintains the reject list.** Papers waved off in review go in [`data/rejected.txt`](data/rejected.txt) so the weekly ingest never resurfaces them.
- **Breaks ties.** If a paper's primary theme is a genuine coin toss, or an extraction needs a tag outside the closed list, that's flagged for a human call — the LLM never invents a value to fill the gap.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Build the static site (runs `validate` first) |
| `npm run validate` | Check every entry against the content model — closed vocabularies, word caps, required fields |
| `npm run ready` | List queued entries so you can review them without opening twenty files |
| `npm run pipeline:run` | Run the weekly ingest by hand (arXiv/Crossref search → resolve → extract → write) |
| `npm run import:backlog <file.csv...>` | Resolve a CSV of `identifier,title,date_found` rows against arXiv/Crossref |
| `npm run import:seed` | Fast-track the IDs listed in [`data/backlog-seed.txt`](data/backlog-seed.txt) straight through extract + write |

The extraction step needs `DEEPSEEK_API_KEY` set in the environment (see [`.env.local`](.env.local) for local runs, or the `ingest.yml` GitHub Actions secret for the real pipeline).

## Where things live

```
src/content/entries/    one markdown file per paper — the actual content
data/                   working state: unresolved rows, the backlog queue, the reject list
scripts/                the pipeline itself (fetch, resolve, extract, write, validate)
docs/planning/          the specs: content model, design system, pipeline, style, import
docs/v1-todo.md         current status and open threads
```

## The rest of the spec

This README covers the pipeline. For everything else — the content schema, the closed vocabularies, the visual design, the house writing style, and the non-goals that keep the site small — start at [`docs/planning/CLAUDE.md`](docs/planning/CLAUDE.md).
