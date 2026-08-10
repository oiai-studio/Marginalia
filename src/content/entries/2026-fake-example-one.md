---
# FAKE PLACEHOLDER ENTRY — scaffolding only, not a real paper.
# Delete once Rob's three real hand-written entries exist (CLAUDE.md).
# `url` points at a stable, generic arXiv listing page (not a specific
# paper) rather than a fake abs/ page, so the live link-check passes
# honestly instead of pointing at something that pretends to be real.

title: "Repair Work in Human-Agent Task Handoff"
authors: "Okonkwo and Bevan"
institutions: "Fictional University (placeholder entry)"
published: 2026-03-14
added: 2026-08-07
status: published
source: manual

venue: "arXiv cs.HC"
venue_type: preprint
url: "https://arxiv.org/list/cs.HC/recent"
arxiv_id: "0000.00001"

theme: supervision
secondary_themes: [collaboration]
tags: [handoff, error-recovery, trust-calibration]

signals:
  model_tested: "GPT-4o, Claude Sonnet 4"
  participants: 18
  population: "software engineers"
  study_type: field-deployment
  task_setting: field-real-work
---

## What they found

Engineers rarely read agent output before accepting it, but reviewed closely
after any single visible failure. That vigilance decayed within roughly two
working days, returning to baseline regardless of the failure's severity.

## Why it matters

If trust recovers on a two-day clock, one good error message will not carry a
handoff design for long.
