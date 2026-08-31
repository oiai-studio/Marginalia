# The machine proposes, the human decides

A scheduled GitHub Action pulls new papers, scores them for relevance and design usefulness, fills the signal fields from full text for the ones that clear the bar, writes entry files with `status: published`, and opens one pull request. Rob reviews and merges, and merging is what puts papers on the site.

**This changed on 2026-08-31, in both directions.** The pipeline used to collect broadly and rank nothing, handing over forty unsorted papers a week; it now judges, and proposes roughly eight. And entries used to be written as drafts for a separate manual status flip; they are now written live, so the pull request is the gate rather than a staging step. Merging is no longer cheap and does carry editorial weight — that is the point of the change, not a side effect of it.

Two safeguards make that trade honest, and both matter more than they look:

- **The model never decides what ships.** It scores one paper at a time, from title and abstract, and never sees the threshold or the other papers' scores. `selectPapers()` in `scripts/lib/judge.mjs` applies the bar, in code.
- **Rejections are visible.** The near-miss table in every PR lists the papers that just missed, with their scores and a one-line reason. A badly set bar shows up as a paper that obviously should have shipped, rather than as an absence nobody can see.

Build this last. Get the site working against hand-written entries first.

## Sources

| Source | Route |
|---|---|
| arXiv cs.HC, cs.AI, cs.CL, cs.LG, cs.CY, cs.IR | arXiv API (`export.arxiv.org/api/query`) |
| CHI, IUI, UIST, CSCW, DIS, HRI, IMWUT (covers UbiComp/MobileHCI), CHI PLAY | Crossref, by container-title relevance search, verified against a venue pattern afterward — never a specific edition's title (see below) |

The ACM Digital Library went fully open access in January 2026, so CHI/IUI/UIST/etc. full texts are now fetchable rather than paywalled. Use the DOI as the canonical `url` for those, and the arXiv abs page for preprints.

Respect rate limits: arXiv asks for one request every three seconds and a descriptive user agent. This runs weekly, so there is no reason to push it.

Two things worth knowing if you touch the source code (`scripts/lib/fetch-crossref.mjs`, `scripts/pipeline/run.mjs`):

- **Never query Crossref by a specific edition's container title** (e.g. "the 28th International Conference on..."). Several venues bake an ordinal into their actual Crossref container-title per year (UIST in particular), so an exact-edition string silently ages badly. Query with a generic venue name instead, and verify the result's real `container-title` against a regex afterward.
- **Never combine `query.container-title` with `sort=published`.** Verified live: it silently discards Crossref's relevance ranking — a search for "Intelligent User Interfaces" returned an unrelated library-science journal as the top hit once date-sorted. Use Crossref's default relevance sort, filter by date, and fetch generously (100 rows), because most of these venues publish in annual bursts rather than continuously — a real week's result is very often correctly zero.

## Weekly run

1. **Query** each arXiv category for the last eight days, requiring at least one AI-concept term **and** (except for `cs.HC`, which is already HCI by definition) at least one UX-concept term — arXiv's query syntax supports this directly (`cat:X AND (ai terms...) AND (ux terms...)`), so it's a precision filter, not a scoring system. Still over-collects within that constraint on purpose: filtering the rest of the way is Rob's PR-review judgment, not the query's job.
2. **Deduplicate** against every `arxiv_id` and `doi` already in `entries/`, and against `rejected.txt`, a plain list of IDs Rob has already said no to. Never resurface a rejection.
3. **Fetch full text.** arXiv renders HTML for most recent submissions; fall back to the PDF. The signal fields live in the methods section, so an abstract-only pass will return `not reported` for nearly everything and is worse than useless.
4. **Triage**, in batches of ten, on title and abstract: is the human, interaction or design contribution real, or incidental? This is where model-optimisation and benchmark papers that happen to contain the word "agent" get dropped. Roughly 40% of candidates survive.
5. **Score** the survivors on four independent 0-5 scales — `hci_relevance`, `design_usefulness`, `empirical_weight`, `novelty`. Papers within a point of the bar are scored twice and the lower verdict stands, because that is where a small model is least stable.
6. **Select**, in code. Hard gate at `hci_relevance >= 3`, then rank by `design_usefulness + empirical_weight + novelty` with equal weights, and take everything at or above the threshold. Equal weights are deliberate: weighted coefficients look precise and are calibrated against nothing. The threshold is calibrated — see `PIPELINE_SCORE_THRESHOLD` in `run.mjs` for the measurement it came from.
7. **Extract** with the prompt below, one call per selected paper, returning JSON. Only papers that survived selection reach this step, which is why broadening retrieval made runs cheaper rather than dearer.
8. **Write** one file per paper per `CONTENT-MODEL.md`, `status: published`, `source: pipeline`.
9. **Open one PR** titled with the count. The body carries a synthesis of what clustered this week, the selected papers with their scores, anything repaired automatically, the near-misses, and anything skipped. Rob reviews from that on a phone, and deletes the files he does not want.

Retrieve up to 400 per arXiv category. There is no editorial cap on how many papers may qualify — the bar decides that — but `PIPELINE_RUN_CEILING` limits how many one run will pay to extract, and anything past it is reported in the near-miss table rather than dropped silently.

Retrieval optimises for recall now that judging does the filtering. `cs.HC` has no keyword gate at all; the noisier categories require an AI term and a human-centred term, both lists deliberately wide. The old AI-AND-UX gate was the main thing losing good papers: a title like "Compass vs Railway Tracks" carries no keywords, and neither may its abstract, while the paper is squarely about how people direct agents.

Two things that bite in practice. arXiv cross-lists heavily, so the same paper comes back from several category queries — `dedupeCandidates()` collapses those before judging, and it was 23% of a real run's volume. And arXiv returns 429 on bursts even inside the documented three-second interval; `rawQuery` retries with a widening backoff, because without it a rate-limited category silently costs a whole week's papers from that source.

## The extraction prompt

Hard rules, stated as hard rules. This model has one job and a strong pull toward being helpful in exactly the wrong way.

```
You are extracting appraisal signals from an academic paper for a reference
index. Return only JSON matching the schema below.

ABSOLUTE RULES

1. Extract only what the paper explicitly states. If a value is not stated,
   return the string "not reported". Never infer, estimate, approximate, or
   reason toward a value. "Not reported" is a correct and useful answer.
2. Never reproduce or lightly reword the abstract, or any sentence from the
   paper. Every word you write in the summary fields is your own phrasing of
   what the paper found.
3. Use only the closed vocabularies given. If nothing fits, return
   "needs-review" and explain in the notes field. Do not invent a value.
4. House style (see STYLE.md), applied to "finding" and "notes": British
   English, plain past tense, straight quotes. No em dashes. No "not just
   X, but Y" or "not X, but Y" constructions. No promotional or
   significance-puffery language (e.g. "cutting-edge", "robust",
   "seamlessly", "plays a pivotal role", "underscores the importance").
   No vague attribution ("researchers found" when the paper names who).
   Don't tack a vague "-ing" consequence onto the end of a sentence after
   a comma; if the consequence has real evidence, write it as its own
   sentence instead.

FIELDS

institutions    Author affiliations exactly as printed on the paper's title
                page or author block, comma-separated for more than one.
                Never infer from an author's name, email domain, or outside
                knowledge of who they are — only from what this paper
                itself states. "not reported" if the paper states none.
model_tested    Exact model names and versions evaluated, as written in the
                paper. If it says "a large language model" with no name,
                that is "not reported".
participants    Integer count of human participants. "n/a" if no human study.
population      Who they were, in five words or fewer, as the paper describes
                them. Not your characterisation.
study_type      One of: [closed list]
task_setting    One of: [closed list]
theme           One of: [closed list, with the five questions]
secondary_themes  Zero to two from the same list.
tags            From the closed tag list only. Anything outside it goes in
                proposed_tags instead.
finding         What they found, in your own words, past tense. Two short
                sentences — match this length and shape exactly:
                "Engineers rarely read agent output before accepting it,
                but reviewed closely after any single visible failure.
                That vigilance decayed within roughly two working days,
                returning to baseline regardless of the failure's
                severity."
                Hard ceiling: 40 words. If you are unsure, write shorter
                rather than longer.
notes           Anything a reader would want flagged: a tiny sample, a
                self-report-only measure, an unreleased system. One sentence
                or empty.
```

This prompt is deliberately forcing `not reported` to be a first-class answer rather than a failure. That will erode if the prompt gets softened later.

`finding`'s length instruction leads with a worked example rather than a bare word count, on purpose. A model processes text as tokens, not words, and has no built-in counting mechanism in a single JSON-extraction call — asking it to hit a precise number is asking for something it structurally can't self-verify. Pattern-matching a shown example's length and shape is something it's actually good at. Verified live (2026-08-10): the bare-number instruction missed the 40-word cap on 16 of 58 real extractions across two runs; `validate-entries.mjs`'s hard cap stays regardless of how well the prompt performs — this is about cutting how often it fires, not replacing it.

## Publishing

Publishing happens on merge. Entries are written `status: published`, so the pull request is the review gate: merge to publish the lot, delete a file to reject that paper. The build renders published entries only, and `validate-entries.mjs` still fails the build on a bad entry, which now blocks the merge — the right shape of gate, since a broken entry can no longer sit quietly in a queue.

The practical consequence, worth stating plainly: a bad extraction that gets merged is live immediately. That is the cost of the trade, and the reason the PR body carries the repairs, near-misses and skips rather than just a list of titles.

A `make ready` helper that lists queued entries with their titles and themes would save him opening twenty files, and is worth building once the rest works.
