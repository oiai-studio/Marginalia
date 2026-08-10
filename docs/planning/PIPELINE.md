# The machine collects and extracts, the human judges

A scheduled GitHub Action pulls new papers, fills the signal fields from full text, writes entry files with `status: queued`, and opens one pull request. Rob reviews and merges. Nothing reaches the site until he separately flips a status field, so merging is cheap and carries no editorial weight.

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
4. **Extract** with the prompt below, one call per paper, returning JSON.
5. **Write** one file per paper per `CONTENT-MODEL.md`, `status: queued`, `source: pipeline`.
6. **Open one PR** titled with the date and the count. Include a table in the PR body: title, theme, participants, study type, link. Rob reviews from that table on a phone and deletes the files he does not want.

Cap each run at forty papers, retrieving up to 150 per arXiv category before that cap applies. If the query returns more, take the most recent and log the rest. (Both numbers are deliberately moderate, not the hundreds a scored/ranked pipeline could justify — there is no ranking step yet, so every extra candidate is one more DeepSeek call and one more row for Rob to review by hand. See `docs/v1-todo.md` for the deferred scoring/semantic-judging proposal.)

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

Publishing is separate from merging, and manual. Rob edits `status: queued` to `status: published` on three or four entries at a time and pushes. The build renders published entries only.

A `make ready` helper that lists queued entries with their titles and themes would save him opening twenty files, and is worth building once the rest works.
