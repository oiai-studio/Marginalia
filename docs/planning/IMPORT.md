# The backlog arrives as three columns, and half the work is not trusting them

Rob's existing bank of papers lives in a long-running ChatGPT conversation that has been finding papers every Friday for months. It comes across as a CSV. Those identifiers were recalled from a chat context, so a meaningful share of them will be plausible and wrong: transposed arXiv numbers, near-miss titles, occasionally a paper that does not exist.

The import script's first job is resolution. Ingestion comes second.

## The CSV

Three columns only. Anything richer gets overwritten by the extraction pass anyway, and every extra column is another surface for something to be quietly wrong.

```csv
identifier,title,date_found
2603.12345,"Steering Behaviour in Agentic Interfaces",2026-04-12
10.1145/3706598.3713021,"Repair Work in Human-Agent Handoff",2026-02-28
```

Expect it in chunks. Long chats truncate on a "give me everything" request, so it will likely arrive in blocks of twenty or by month, and the script should accept multiple files and merge.

## Resolution

For each row:

1. If the identifier looks like an arXiv ID, query the arXiv API. If it looks like a DOI, query Crossref.
2. Compare the returned title against the CSV title with a fuzzy match. Below roughly 0.85 similarity, treat it as a miss.
3. On a miss or a non-resolving identifier, fall back to a title search against arXiv and Crossref.
4. Still nothing, or an ambiguous match, writes the row to `unresolved.csv` with whatever candidates were found.

Never guess, never pick the top result to be helpful. An unresolved row costs Rob ten seconds to eyeball; a wrong one sits on the site looking authoritative.

Log resolution rate at the end of the run. If it comes in under about 70%, something is wrong with the export rather than the script, and it is worth saying so rather than ploughing on.

## After resolution

Resolved rows join the same path as everything else: full text fetch, extraction, entry file, `status: queued`. The only difference is `source: backlog`, so Rob can tell later which entries came from the old bank.

Do not import the whole backlog at once. At ninety seconds of review per paper, a hundred papers is an afternoon he does not have, and it blocks launch behind a triage exercise. Instead:

- Rob picks fifteen or twenty he already knows are good. Those go through first and seed the site.
- The rest sit in `backlog-queue.csv` and the weekly Action pulls five of them alongside new papers, until it is drained.

The site launches next week, and the backlog drains itself over a couple of months.

## One caveat worth keeping in mind

That chat selected papers under criteria that emerged over months of conversation, and those will not be the criteria Rob sets for the site. Treat every imported row as a candidate rather than an entry. A high rejection rate on the backlog is the system working.
