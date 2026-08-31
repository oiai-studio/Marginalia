// Editorial judging: the step between "does this match the query" and
// "would this give a thoughtful product designer a useful new idea".
// Retrieval answers the first, this answers the second (PIPELINE.md).
//
// Two passes on title + abstract, deliberately kept separate: triage
// asks one yes/no question, scoring asks for four numbers. Asking a
// cheap model one thing at a time is the biggest reliability lever
// available, and it keeps a bad answer cheap — a triage miss drops one
// paper, it doesn't corrupt a score.
//
// Three rules this module holds to, all of them about not trusting the
// model further than it can be checked:
//
//   1. The model scores ONE paper at a time, locally. It never sees the
//      threshold, never ranks the set, and never decides what ships.
//      selectPapers() below does that, in code, deterministically.
//   2. The model never touches a closed vocabulary here. No themes, no
//      tags — that's extraction's job, and keeping it out of this step
//      removes DeepSeek's documented theme/tag confusion (v1-todo.md)
//      from the judging path entirely.
//   3. A malformed item degrades to a zero score and a logged reason.
//      It never throws, and it never takes its batch down with it.
//
// callModel is injectable for the same reason it is in extract.mjs:
// prompt-building and response-parsing stay testable against a fixture,
// with no provider involved.

import { callDeepSeek } from './extract.mjs';

/** Papers per model call. Small on purpose — attention per item drops
 * as batches grow, and one bad response costs ten items, not fifty. */
export const BATCH_SIZE = 10;

const SCORE_FIELDS = ['hci_relevance', 'design_usefulness', 'empirical_weight', 'novelty'];

function abstractFor(candidate) {
  const text = (candidate.abstract ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '(no abstract available — judge on title and venue alone, and be conservative)';
  // Long enough to judge on, short enough to keep ten of them in one call.
  return text.length > 1500 ? `${text.slice(0, 1500)}...` : text;
}

function paperBlock(candidate, index) {
  return `--- PAPER ${index + 1}
title: ${candidate.title}
venue: ${candidate.venue ?? 'unknown'}
abstract: ${abstractFor(candidate)}`;
}

export function buildTriagePrompt(batch) {
  return `You are triaging academic papers for an index read by product designers
building AI products. One question per paper, nothing else.

THE QUESTION

Is the human, interaction or design contribution a real contribution of this
paper, or is it incidental?

Keep a paper if it is substantially about any of: designers working with AI,
users interacting with AI, interface or interaction patterns, UX evaluation,
trust, agency or control, human-agent collaboration, new design tools or
workflows, or the cognitive and behavioural effects of AI products.

Drop a paper whose real subject is model optimisation, inference speed or cost,
benchmark or leaderboard results, robotics or motor control, reinforcement
learning method work, or model architecture. The words "agent", "interface",
"human" and "user" appear constantly in papers of exactly that kind. Judge what
the work is actually about, not which words it contains.

Two things worth knowing. A title can be uninformative while the paper is
excellent, so read the abstract rather than the title. And a paper with no
humans in it at all is usually a drop here, however clever the system is.

RESPONSE FORMAT

Return only JSON: an object with a "papers" array, one entry per paper given, in
the order given. Match this shape exactly:

{"papers": [
  {"n": 1, "verdict": "keep", "reason": "interview study of how designers hand work to coding agents"},
  {"n": 2, "verdict": "drop", "reason": "KV-cache scheduling, no human involvement"}
]}

"reason" is at most 15 words and says what the paper is actually about.

PAPERS

${batch.map(paperBlock).join('\n\n')}`;
}

export function buildScoringPrompt(batch) {
  return `You are scoring academic papers for an index read by product designers
building AI products. Score each paper on four scales, independently.

HOW TO USE THE SCALE

This is the part most people get wrong, so read it twice.

Every paper here has already passed a filter, so they are all plausible. Your
job is to separate them, and you cannot do that if you give everything a 4.
**In a normal week most scores are 2 or 3.** A 4 is a good paper. A 5 is one you
would still remember a month later — perhaps one paper in a batch of ten earns a
single 5, and often none do.

If you find yourself giving 4s and 5s to most papers, you are scoring too
generously and the whole exercise stops working. Being generous is not being
fair to the good ones.

THE SCALES — each an integer from 0 to 5

hci_relevance      Is this genuinely UX/HCI x AI research?
                   5  the human interaction question IS the paper
                   3  a real human component inside a technical paper
                   1  humans appear only as annotators or evaluators
                   0  the human angle decorates a technical contribution

design_usefulness  Could a working product designer use or think with this
                   next week?
                   5  a concrete pattern or finding that changes how you
                      would design something on Monday
                   3  a useful idea, but one that needs translating first
                   1  sound work with nothing a practitioner could apply
                   0  purely internal to the research community

empirical_weight   How much evidence is behind it?
                   5  substantial user study, field deployment, longitudinal
                      work, or a serious practitioner interview study
                   3  a small or lab-only evaluation
                   1  a pilot, a demo, or a handful of participants
                   0  no evaluation at all

novelty            Does it introduce an interaction idea worth knowing, or
                   confirm something already understood?
                   5  a genuinely new interaction pattern
                   3  a known idea applied somewhere new, with a twist
                   1  confirms what the field already believed
                   0  nothing new

Score each scale on its own. A position paper with no study can still score 4 on
design_usefulness and 0 on empirical_weight, and that is a correct answer rather
than a contradiction. Do not average the scales together and do not decide which
papers are best overall — that is not your job, and the numbers are combined
elsewhere.

RESPONSE FORMAT

Return only JSON: an object with a "papers" array, one entry per paper given, in
the order given. Match this shape exactly:

{"papers": [
  {"n": 1, "hci_relevance": 5, "design_usefulness": 4, "empirical_weight": 4, "novelty": 3,
   "reason": "controlled study of how people repair agent errors mid-task"},
  {"n": 2, "hci_relevance": 2, "design_usefulness": 1, "empirical_weight": 5, "novelty": 1,
   "reason": "large benchmark of retrieval accuracy, humans only as annotators"},
  {"n": 3, "hci_relevance": 3, "design_usefulness": 2, "empirical_weight": 3, "novelty": 2,
   "reason": "lab study confirming known trust effects in a new domain"}
]}

Note the third example. A competent, publishable paper that tells the field
something it broadly expected is a 2-and-3 paper, not a 4-and-5 paper. Most
papers look like that one.

"reason" is at most 15 words, and explains the scores rather than restating the
title.

PAPERS

${batch.map(paperBlock).join('\n\n')}`;
}

function parsePapersArray(responseText) {
  const raw = JSON.parse(responseText);
  const papers = Array.isArray(raw) ? raw : raw.papers;
  if (!Array.isArray(papers)) throw new Error('response had no "papers" array');
  return papers;
}

/** Indexes a model's response by its 1-based `n`, so a batch that comes
 * back short, reordered, or with a duplicated entry still lines up with
 * the right paper instead of silently shifting every score by one. */
function byPaperNumber(papers) {
  const map = new Map();
  for (const item of papers) {
    const n = Number(item?.n);
    if (Number.isInteger(n) && !map.has(n)) map.set(n, item);
  }
  return map;
}

async function callWithRetry(prompt, callModel, label) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return parsePapersArray(await callModel(prompt));
    } catch (err) {
      if (attempt === 2) {
        console.error(`  ${label} batch failed twice (${err.message}) — items degraded, not dropped.`);
        return [];
      }
      console.error(`  ${label} batch attempt ${attempt} failed (${err.message}), retrying once.`);
    }
  }
  return [];
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Pass 1. Returns { kept, dropped } — every candidate appears in exactly
 * one of them. A candidate the model didn't answer for is KEPT, with a
 * reason saying so: an unanswered paper is a model failure, and failing
 * towards the more expensive path is the safe direction. It costs one
 * scoring slot; failing the other way would silently lose good papers.
 */
export async function triageCandidates(candidates, { callModel = callDeepSeek } = {}) {
  const kept = [];
  const dropped = [];

  for (const batch of chunk(candidates, BATCH_SIZE)) {
    const answers = byPaperNumber(await callWithRetry(buildTriagePrompt(batch), callModel, 'triage'));

    batch.forEach((candidate, i) => {
      const answer = answers.get(i + 1);
      const reason = typeof answer?.reason === 'string' ? answer.reason : '';

      if (!answer) {
        kept.push({ ...candidate, triageReason: 'no triage verdict returned, kept for scoring' });
      } else if (answer.verdict === 'drop') {
        dropped.push({ ...candidate, triageReason: reason || 'dropped at triage' });
      } else {
        kept.push({ ...candidate, triageReason: reason });
      }
    });
  }

  return { kept, dropped };
}

function readScores(answer) {
  const scores = {};
  for (const field of SCORE_FIELDS) {
    const value = Number(answer?.[field]);
    // Anything non-numeric or out of range reads as 0 rather than
    // NaN-poisoning the total or throwing.
    scores[field] = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : 0;
  }
  return scores;
}

/** design_usefulness + empirical_weight + novelty, equal weights.
 *
 * Equal on purpose. v1-todo.md warned off the earlier proposal's invented
 * coefficients ("hciRelevance*0.30 + ...") as precise-looking numbers
 * calibrated against nothing. Equal weights are honest about that, and
 * every score reaches the PR so the threshold can be tuned against real
 * output instead of guessed at. hci_relevance is deliberately not in the
 * total — it is a gate in selectPapers, not a contributor. */
export function totalScore(scores) {
  return scores.design_usefulness + scores.empirical_weight + scores.novelty;
}

/**
 * Pass 2. Returns each candidate with `scores`, `total` and `judgeReason`.
 * A candidate the model didn't answer for scores 0 and says so — it will
 * land in the near-miss table where a human can see it was never judged,
 * rather than disappearing.
 */
export async function scoreCandidates(candidates, { callModel = callDeepSeek } = {}) {
  const scored = [];

  for (const batch of chunk(candidates, BATCH_SIZE)) {
    const answers = byPaperNumber(await callWithRetry(buildScoringPrompt(batch), callModel, 'scoring'));

    batch.forEach((candidate, i) => {
      const answer = answers.get(i + 1);
      const scores = readScores(answer);
      scored.push({
        ...candidate,
        scores,
        total: totalScore(scores),
        judgeReason: typeof answer?.reason === 'string' ? answer.reason : 'no score returned',
        judged: Boolean(answer),
      });
    });
  }

  return scored;
}

/**
 * Re-scores the papers sitting within `band` of the threshold and keeps
 * the lower of the two verdicts, so a borderline paper has to clear the
 * bar twice. Cheap, and aimed at the exact place a small model is least
 * stable: the papers where one point either way decides whether they
 * publish. Papers far from the threshold are left alone.
 */
export async function confirmBorderline(scored, { threshold, band = 1, callModel = callDeepSeek } = {}) {
  const borderline = scored.filter((p) => Math.abs(p.total - threshold) <= band);
  if (borderline.length === 0) return scored;

  console.log(`  re-scoring ${borderline.length} borderline papers (within ${band} of the bar).`);
  const second = await scoreCandidates(borderline, { callModel });
  const secondByKey = new Map(second.map((p) => [p.arxivId ?? p.doi, p]));

  return scored.map((paper) => {
    const other = secondByKey.get(paper.arxivId ?? paper.doi);
    if (!other) return paper;
    return other.total < paper.total
      ? { ...other, judgeReason: `${other.judgeReason} (lower of two passes)` }
      : paper;
  });
}

/**
 * The selection rule, in code. Pure function of the scores — no model
 * call, nothing time-dependent, so it can be reasoned about and tested
 * directly.
 *
 * `ceiling` is a spend limit, not an editorial one: papers past it are
 * marked `overCeiling` and reported, never silently dropped. Rob's call
 * was a quality bar with no cap on what qualifies; this only bounds what
 * one run will pay to extract.
 */
export function selectPapers(scored, { threshold, relevanceGate = 3, ceiling = Infinity } = {}) {
  const ranked = [...scored].sort((a, b) => b.total - a.total || b.scores.hci_relevance - a.scores.hci_relevance);

  const qualified = [];
  const nearMisses = [];

  for (const paper of ranked) {
    if (paper.scores.hci_relevance < relevanceGate) {
      nearMisses.push({ ...paper, missReason: `hci_relevance ${paper.scores.hci_relevance} below gate of ${relevanceGate}` });
    } else if (paper.total < threshold) {
      nearMisses.push({ ...paper, missReason: `scored ${paper.total}, bar is ${threshold}` });
    } else {
      qualified.push(paper);
    }
  }

  const selected = qualified.slice(0, ceiling);
  const overCeiling = qualified.slice(ceiling).map((paper) => ({
    ...paper,
    missReason: `qualified at ${paper.total} but over the ${ceiling}-paper run ceiling`,
    overCeiling: true,
  }));

  return { selected, nearMisses: [...overCeiling, ...nearMisses] };
}

/**
 * The weekly synthesis for the PR body: what clusters this week, and
 * what it might mean. Machine-written interpretation, and labelled as
 * such where it renders. It exists to help review a pull request and
 * never reaches an entry file — CONTENT-MODEL.md's "there is no opinion
 * field" is untouched by it.
 */
export async function clusterAndSynthesise(selected, { callModel = callDeepSeek } = {}) {
  if (selected.length < 2) return '';

  const list = selected
    .map((p, i) => `${i + 1}. ${p.title}\n   ${p.judgeReason}`)
    .join('\n');

  const prompt = `These papers were selected for this week's HCI/AI index. Say what, if
anything, they have in common.

Write at most four sentences of plain British English, past tense where it
applies. Name the clusters you actually see ("three concern agent supervision"),
and say plainly if there is no common thread — "no strong thread this week" is a
correct and useful answer. Do not praise the papers, do not pad, and do not
restate the titles back.

Return only JSON: {"synthesis": "..."}

PAPERS

${list}`;

  try {
    const raw = JSON.parse(await callModel(prompt));
    return typeof raw.synthesis === 'string' ? raw.synthesis.trim() : '';
  } catch (err) {
    console.error(`  synthesis failed (${err.message}) — PR body will omit it.`);
    return '';
  }
}
