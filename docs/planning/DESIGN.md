# Build it as a typed document, not a designed page

The reference is a museum archive index: aged off-white paper, one typewriter face at one or two sizes, and every piece of interface furniture made out of characters rather than components. Checkboxes are `[x]` and `[ ]`. Column headers are `[LIKE THIS]`. Rules are dashed lines. There is no colour, no icon set, and nothing that could not have come off a monospaced printer.

That direction suits this project almost too well. A site whose entire argument is "here are the appraisal fields, you decide" should look like a printout of the fields.

## The signature element

A signal strip under every paper title: five fields in a fixed order, in columns, in mono.

```
[MODEL]              [N]   [WHO]                [METHOD]              [SETTING]
GPT-4o, Sonnet 4     24    CS undergraduates    controlled exp.       lab, synthetic
--                   12    crowdworkers         wizard of oz          lab, synthetic
GPT-4                --    --                   system paper, no eval --
```

Because it is monospaced and fixed-order, the gaps align down the page. Scroll the index and the pattern of missing values becomes a legible texture. That is the whole editorial argument of the site made visually, with no commentary, and it is the one place to spend any boldness.

Absence renders as `--` in the muted tone, with the full phrase `not reported` as the title attribute. Never hide the field, never collapse the column.

## Tokens

```css
--paper:  #EDEBE5;   /* aged off-white, warm, slightly yellowed */
--ink:    #2A2A26;   /* soft near-black with a brown cast, never #000 */
--muted:  #8C897F;   /* secondary text, absence markers, unchecked boxes */
--rule:   #C4C0B6;   /* dashed hairlines only, never a box or a fill */
```

Four values, no accent. The reference has no accent colour and does not need one, because emphasis comes from bracket notation and case rather than hue. Resist adding a fifth.

Two deliberate calls that follow from this:

- **No dark mode.** This is a paper object. Inverted, it stops being one. `prefers-color-scheme` is ignored on purpose, and that is a design decision rather than an omission.
- **No colour flag for dated models.** The ochre marker in the earlier draft is gone. Papers testing a model older than roughly eighteen months carry `[DATED]` in the strip, in the muted tone. Typography does the work.

Add a paper grain: an inline SVG `feTurbulence` at very low opacity, fixed to the viewport, no image request. Subtle enough that it reads as texture rather than pattern.

## Type

One family, monospaced, throughout. Every character on the site comes from it.

**IBM Plex Mono** at 300 and 400 is the recommendation: light enough to sit quietly at small sizes, technical rather than kitsch, and free to self-host. **Courier Prime** is the alternative if you want the typewriter reading pushed further, at the cost of a smaller x-height and a weaker screen render. Pick one, self-host the subset, do not call a font CDN.

Two sizes only:

- 13px / 1.6 for titles and summary text
- 11px / 1.5, uppercase, letterspaced 0.08em, for every label, header, signal value, and control

Case does the hierarchy that size normally would. Content is sentence case, chrome is uppercase, and that distinction alone carries the whole page. If a third size feels necessary, the layout is wrong.

## Interface out of characters

- Filters are checkbox rows: `[x]` for the active route, `[ ]` for the others. They are ordinary links styled to look like a form, which keeps every view linkable and ships no JavaScript.
- Column headers sit in square brackets and uppercase: `[MODEL]`, `[N]`, `[METHOD]`.
- Section dividers are dashed 1px borders in `--rule`, not solid.
- The theme list on the homepage reads as a checkbox stack, with the entry count aligned hard right on the same line, as in the reference.
- Links are underlined in the body and bracketed in the chrome: `[read the paper]`. No buttons anywhere on the site.
- Hover changes the underline or the bracket, nothing else. No transitions beyond a 120ms disclosure.

## Layout

Wider than a blog column. The reference runs the index near full width so the columns can breathe, and the signal strip needs that room. Cap the content at about 1200px, with 48px gutters on desktop and 20px on mobile.

At narrow widths the strip cannot hold five columns, so below roughly 700px it stacks into labelled rows (`[N] 24`) inside the expanded entry, and the collapsed row shows title, venue, year and nothing else. Design that state first: this gets used on a phone mid-meeting, and mono at 11px wraps badly if you leave it to chance.

Expansion uses `<details>` and `<summary>` — no script needed, and that stays true regardless of what else the site grows. Default to plain HTML/CSS first, the way expansion and the theme/tag filters do: it's simpler, and simple is the point.

That default is not a hard ban. This is a static site, not an app — no framework, no client-side routing, no hydration machinery — but a small, framework-free script scoped to one specific feature is fine when it earns its place and plain HTML/CSS genuinely can't do the job. The bar is "does this feature need it", not "is JavaScript allowed."

## On imagery

The references are object archives, so photographs carry them. This site has no objects. Do not solve that by pulling figures out of the papers: it reintroduces the content duplication the project is built to avoid, and the licensing varies paper by paper.

The texture here comes from the aligned columns and the field gaps instead. If a single image is ever wanted on the homepage, it goes greyscale with a slight desaturation and a touch of warmth over it so it sits in the paper stock rather than on top of it: `filter: grayscale(1) contrast(0.92) sepia(0.08)`. One, at most, and the site is better without it.

## Never signal the site's own staleness

No masthead date. No "updated", "latest", "this week", "issue", or "volume". No archive organised by period. Default order is the paper's own publication date, newest first; the date an entry was added is stored and never shown.

The homepage opens with one sentence explaining what the site is and how to read the signals, then goes straight into the list. No hero, no about section.

## Quality floor

Keyboard focus visible as a 2px `--ink` outline. `prefers-reduced-motion` respected. Contrast checked at AA against `--paper`, which matters more than usual at 11px in a light weight, so verify rather than assume. Fully readable with CSS disabled.

Before shipping, take one accessory off. If an element cannot be traced back to a field in `CONTENT-MODEL.md`, cut it.
