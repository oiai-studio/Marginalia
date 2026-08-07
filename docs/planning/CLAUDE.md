# The build brief lives in five files, and the non-goals matter most

A public, static, opinionated index of academic papers on human-AI interaction, maintained by one person alongside a full-time job. Read this file first, then the four specs it points to. Follow them exactly. Where a spec and this file disagree, this file wins.

## What it is

Rob has been tracking new HCI and AI papers weekly for months and has a large backlog. Existing UX frameworks are struggling in AI product work, so he reads academia for thinking that transfers to live products. This site is that reading, made public.

Each entry is one paper, reduced to a set of appraisal signals (who was tested, on which model, in what setting) plus two lines of summary, and a link out to the original. The reader draws their own conclusion. The site does not score, rank, or rate papers.

The editorial act is selection. Nothing else.

## Who it is for

Practising product designers and researchers building AI products, looking up what the research says about a problem they have today. Assume they are competent, short of time, and often on a phone.

## Non-goals

Treat these as hard constraints, not preferences. Do not build them, and do not leave scaffolding for them.

1. **No per-paper detail pages.** One index. Each entry expands in place. A detail page is empty space demanding prose, and prose is the failure mode here.
2. **No scores, ratings, star systems, or quality verdicts.** Surface signals, stay silent on conclusions.
3. **No hosted full text, and no reproduced abstracts.** Every summary is written fresh in Rob's own words. Link out for the rest.
4. **No accounts, comments, analytics, cookie banners, or newsletter capture.**
5. **No search in v1.** Theme and tag routes cover it.
6. **No auto-publishing.** The pipeline writes drafts. A human flips them live.
7. **No masthead date, "latest issue", or edition-based archive.** Publishing is irregular by design and the site must never look abandoned. See `DESIGN.md`.
8. **No JavaScript framework.** See `DESIGN.md` for what the site is allowed to ship.

## The files

- `CONTENT-MODEL.md` sets the frontmatter schema and the closed vocabularies. Start here; everything else depends on it.
- `DESIGN.md` sets the visual system, layout, and the build-time constraints that keep the site short.
- `PIPELINE.md` covers the weekly ingest, the extraction prompt, and the triage flow.
- `IMPORT.md` covers the one-off backlog import from CSV.
- `entries/_template.md` is the entry shape. Rob will write three real ones by hand before any generated entry ships; treat those three as the standard, not this template.
- `STYLE.md` is Rob's house writing style. It governs every word on the site, every summary, and the extraction prompt's output. He will drop this in; if it is not present, ask before writing any prose.

## Suggested order of work

1. Scaffold the repo and the content model. No styling yet.
2. Build the index page against three hand-written entries.
3. Add theme and tag routes.
4. Add the build-time length checks.
5. Then, and only then, the ingest pipeline.

Get the shape right with five entries before automating the arrival of five hundred.
