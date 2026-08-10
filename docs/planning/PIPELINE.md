# The machine collects and extracts, the human judges

A scheduled GitHub Action pulls new papers, fills the signal fields from full text, writes entry files with `status: queued`, and opens one pull request. Rob reviews and merges. Nothing reaches the site until he separately flips a status field, so merging is cheap and carries no editorial weight.

Build this last. Get the site working against hand-written entries first.

## Sources

| Source | Route |
|---|---|
| arXiv cs.HC, cs.AI, cs.CL | arXiv API (`export.arxiv.org/api/query`), or OAI-PMH for bulk |
| CHI, IUI | Crossref by ISBN or container title, then the ACM DOI |

The ACM Digital Library went fully open access in January 2026, so CHI and IUI full texts are now fetchable rather than paywalled. Use the DOI as the canonical `url` for those, and the arXiv abs page for preprints.

Respect rate limits: arXiv asks for one request every three seconds and a descriptive user agent. This runs weekly, so there is no reason to push it.

## Weekly run

1. **Query** each arXiv category for the last eight days, with a small keyword filter over title and abstract (`human-AI`, `LLM`, `agent`, `interface`, `user study`, `interaction`, `trust`, `collaboration`, and similar). Over-collect. Filtering hard here throws away the interesting edges.
2. **Deduplicate** against every `arxiv_id` and `doi` already in `entries/`, and against `rejected.txt`, a plain list of IDs Rob has already said no to. Never resurface a rejection.
3. **Fetch full text.** arXiv renders HTML for most recent submissions; fall back to the PDF. The signal fields live in the methods section, so an abstract-only pass will return `not reported` for nearly everything and is worse than useless.
4. **Extract** with the prompt below, one call per paper, returning JSON.
5. **Write** one file per paper per `CONTENT-MODEL.md`, `status: queued`, `source: pipeline`.
6. **Open one PR** titled with the date and the count. Include a table in the PR body: title, theme, participants, study type, link. Rob reviews from that table on a phone and deletes the files he does not want.

Cap each run at twenty-five papers. If the query returns more, take the most recent and log the rest.

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
finding         What they found, 40 words maximum, your own words.
notes           Anything a reader would want flagged: a tiny sample, a
                self-report-only measure, an unreleased system. One sentence
                or empty.
```

This prompt is deliberately forcing `not reported` to be a first-class answer rather than a failure. That will erode if the prompt gets softened later.

## Publishing

Publishing is separate from merging, and manual. Rob edits `status: queued` to `status: published` on three or four entries at a time and pushes. The build renders published entries only.

A `make ready` helper that lists queued entries with their titles and themes would save him opening twenty files, and is worth building once the rest works.
