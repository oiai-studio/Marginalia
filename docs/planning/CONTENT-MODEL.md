# One paper is one markdown file, and every field is a closed list

Entries live at `entries/<year>-<arxiv-id-or-doi-slug>.md`. Frontmatter carries everything the site renders. The body carries the two summary fields and nothing else.

## Schema

```yaml
---
title: "Exact title as published"
authors: "Okonkwo et al."        # first author + et al., or up to two names
institutions: "MIT, Google DeepMind"  # as printed on the paper, comma-separated
published: 2026-03-14            # the paper's own date, not the date added
added: 2026-08-07
status: queued                   # queued | published
source: pipeline                 # pipeline | backlog | manual

venue: "arXiv cs.HC"
venue_type: preprint             # preprint | peer-reviewed
url: "https://arxiv.org/abs/2603.12345"
arxiv_id: "2603.12345"           # omit if none
doi: "10.1145/0000000.0000000"   # omit if none

theme: supervision               # exactly one
secondary_themes: [interaction]  # zero to two
tags: [error-recovery, uncertainty]

signals:
  model_tested: "GPT-4o, Claude Sonnet 4"
  participants: 24
  population: "CS undergraduates"
  study_type: controlled-experiment
  task_setting: lab-synthetic
---
```

## The signals are the point, and absence is a value

Every signal field is required in the file. Where the paper does not state it, the value is the literal string `not reported`. Never infer, estimate, or fill from context. A paper that does not name the model it tested is telling the reader something, and the site's job is to let that show.

`institutions` follows the same rule, and it lives outside `signals` alongside `authors` and `venue` — it is bibliographic metadata about who published the paper, not an appraisal signal about the study itself. Take it only from the paper's own title page or author block, exactly as printed, comma-separated for more than one. Never infer an institution from an author's name, email domain, or outside knowledge of who they are. If the paper states none, the value is `not reported`.

`participants` is an integer, `not reported`, or `n/a` for papers with no human study. Do not convert "a small group" into a number.

## Closed vocabularies

Validate these at build time. An unrecognised value fails the build.

**theme** (one of five, and the label is the question)

| slug | label |
|---|---|
| `collaboration` | How do we collaborate with intelligence? |
| `supervision` | How do we supervise intelligence? |
| `relationships` | How do we build relationships with intelligence? |
| `interaction` | How do we interact with intelligence? |
| `design-practice` | How do we design using intelligence? |

A paper appears in the feed once, under its primary theme only. Secondary themes affect filtering, not placement. Papers straddle constantly; if the primary is genuinely a coin toss, that is a signal the entry needs a sharper summary, not a second listing.

**study_type**: `controlled-experiment`, `field-deployment`, `interview-study`, `survey`, `diary-study`, `wizard-of-oz`, `system-paper-no-eval`, `literature-review`, `benchmark-or-dataset`, `position-paper`

**task_setting**: `lab-synthetic`, `lab-realistic`, `field-real-work`, `simulated-no-humans`, `n/a`

**venue_type**: `preprint`, `peer-reviewed`

**tags** are design situations, not topics. They answer "what am I working on today", which is the whole retrieval story in v1. Keep the list closed and short, and add to it deliberately rather than letting the extraction step invent new ones:

`handoff`, `error-recovery`, `uncertainty`, `delegation`, `undo-and-repair`, `onboarding`, `trust-calibration`, `over-reliance`, `steering-and-control`, `explanation`, `memory-and-context`, `multi-agent`, `evaluation-methods`, `creative-work`, `expert-workflows`

An extraction that wants a tag outside this list flags it in the PR for Rob to accept or reject. It does not add it.

## The body

Two fields, both hard-capped, both checked at build.

```markdown
## What they found

Forty words, maximum. Written fresh, never lifted or lightly reworded from the
abstract. Plain past tense. The finding, not the framing.

## Why it matters

One sentence. Rob's read on what it changes for someone building something.
This is the only opinionated line on the page, so it earns its place or it is
left empty.
```

If a finding will not fit in forty words, that is usually a sign the entry is trying to carry the paper rather than point at it. Cut, and let the link do its job.

## Build-time validation

Fail the build, do not warn, on any of:

- a frontmatter field missing, or a closed-vocabulary value unrecognised
- `## What they found` over 40 words
- `## Why it matters` over 30 words or containing more than one full stop
- a `url` that does not resolve to a 200 on a link check
- a duplicate `arxiv_id` or `doi`

Warnings get ignored on a Tuesday afternoon. A red build does not.
