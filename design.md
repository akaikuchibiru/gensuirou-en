# Gensuirou · design system

Locked by Hallmark on 2026-07-29. **This file is the source of truth.** Pages in this
project must share the system, not differ from each other — the diversification rule is
inverted on `design.md`-managed projects.

- **Genre** — editorial
- **Macrostructure** — Photographic (`references/macrostructures/08-photographic.md`)
- **Theme route** — custom (tuned). Not a catalog theme; the palette is anchored on the
  existing brand gold rather than rotated.
- **Vibe** — 阿蘇の夜、金と墨、静けさ
- **Axes** — dark / classical-serif / chromatic-amber ~82

## Position

A luxury ryokan sells a feeling before it sells a room. The photographs carry the page;
type is annotation, not headline. Every fold is an image; the image edge is the divider.
There are no rules between sections, no eyebrow labels, and no card grids — the restraint
is the brand.

## Colour

Dark paper, single gold accent. Nothing else carries chroma.

| Token | Value | Role |
|---|---|---|
| `--color-paper` | `oklch(13% 0.010 70)` | base surface (lifted off pure black, warm-tinted) |
| `--color-paper-2` / `-3` | `oklch(17% / 21% …)` | elevation steps — brighter is higher |
| `--color-ink` | `oklch(93% 0.012 85)` | primary text |
| `--color-ink-2` | `oklch(78% 0.014 82)` | body default |
| `--color-muted` | `oklch(62% 0.014 80)` | secondary copy — **the floor for text** |
| `--color-neutral` | `oklch(48% 0.012 78)` | rules and non-text only (fails 4.5:1 as copy) |
| `--color-rule` / `-2` | `oklch(30% / 25% …)` | hairlines |
| `--color-rule-strong` | `oklch(44% 0.022 78)` | UI boundaries (≥3:1) |
| `--color-accent` | `oklch(74% 0.120 82)` | the gold. Active state, one CTA border, focus |
| `--color-accent-ink` | `= paper` | text on an accent fill |
| `--color-focus` | `oklch(78% 0.180 82)` | focus ring only |
| `--color-invalid` | `oklch(64% 0.160 28)` | `:user-invalid` field border |

**Channel triplets** (`--ch-paper`, `--ch-shade`, `--ch-accent`) exist so scrims compose as
`oklch(var(--ch-shade) / 0.55)`. No raw colour value ever appears outside `tokens.css`.

Accent footprint stays under ~5 % of any viewport. It is a highlighter, not a fill.

## Type

Three families, language-scoped. At most two render at once.

- `--font-latin` **Cormorant Garamond** — display, and the wordmark in *every* language
- `--font-ja` **Sawarabi Mincho** — JA reading face
- `--font-zh` **Noto Serif SC** — ZH reading face

**Delivery (2026-09-03).** The three faces are self-hosted as subsets of exactly the
glyphs this site renders — Google Fonts pulled 479 KB (JA/EN) and 1,380 KB (ZH) of
sliced webfont per visit. Same faces, same shapes; only the delivery changed.
Two consequences the doctrine has to name:

- Each stack must end in a face we actually ship, because Latin-first elements do
  carry Japanese (「ご予約」「目次」). Without it those glyphs fall to whatever the
  device has — mincho on Apple, gothic on Android.
- Sawarabi Mincho does not contain 瓏 (the house name), 凛, 瑩, — , → or ※.
  A 3 KB companion cut from Noto Serif JP (`Gensuirou Kanji Extra`) sits behind it.

Adding copy means re-cutting the subsets (`./scripts/make-fonts.sh`); an uncut glyph
renders in a system face and nothing goes red. `scripts/check-fonts.mjs` is the gate.

The Latin wordmark register against a CJK reading face is what keeps the page branded.
Scale is a 1.25 major third off a 16 px base. Display clamps at `5.25rem`.

**Headings are roman. Always.** Italic is body-copy emphasis only.
CJK carries `word-break: auto-phrase; line-break: strict` so a line never ends on an
orphaned kana.

## Structure

| Slot | Archetype |
|---|---|
| Hero | **H6** photographic fold — full-bleed, caption lower-left, text overlaid |
| Section head | **S2** hanging — left-biased, no rule, **no eyebrow** |
| Stats | **T4** numbered strip — real figures only |
| Villas | **F6** product card grid |
| CTA | **C3** typographic link + one outlined chip |
| Nav | **N9** edge-aligned minimal — wordmark left, controls right, middle empty |
| Footer | **Ft1** mast-headed |

**The nav's empty middle is the design.** The eight destinations live in a full-screen
index behind one disclosure. Adding an inline link row makes it N1 with extra steps, which
is the single most-recognised AI nav fingerprint.

**Eyebrows are off.** No `01 · SECTION` labels. The `.kicker` class is retained so old
markup doesn't break, but it renders `display: none`.

## Motion

Three primitives, no more: `hero-entrance` (one orchestrated rise), `image-bloom` (hover,
`@media (hover: hover)` only), `rule-draw`. Scroll reveal is opacity-only — content should
*be there*, not arrive. Everything collapses under `prefers-reduced-motion: reduce`.

Easings: `--ease-out` / `--ease-in` / `--ease-in-out`. Never the browser default.

## Non-negotiables

- `overflow-x: clip` on both `html` and `body` — never `hidden` (it kills iOS sticky).
- Every image-bearing grid track is `minmax(0, 1fr)`, never bare `1fr`.
- Clickable text never wraps: `white-space: nowrap` on affordances; collapse the row instead.
- Hit targets ≥ 44 px. Form fields ≥ 16 px font (iOS must not zoom).
- `:focus-visible` is visible, high-contrast, and **never animated**.
- Text colour floor is `--color-muted`. Verified by measurement, not by eye —
  see the checkers under `scripts/` in the commit message.
- No response-time promises in copy. The site cannot commit staff to a reply window.
- **Real numbers only.** 12 villas · 4,000 坪 · 1,000 m · est. 2023 are from the source.
  Never invent a figure to fill a stat slot.

## Known debt

Page-hero JPGs (`rooms_main.jpg`, `onsen_main.jpg`, and likely the rest) have the Japanese
page title **burned into the image** at lower-right. The live caption is the only
multilingual, accessible version, so the two now duplicate — and EN/ZH visitors see a
Japanese title they can't read. Fixing this needs the assets retouched or re-cropped; CSS
cannot remove pixels. See the handover note.

## Exports

`tokens.css` at the project root is the portable token layer. Every page links it *before*
`assets/site.css`.
