# DESIGN.md — the visual system of EdithLab / Rita

This is the source of truth for every visual change. It was written from the code that is
already shipped (`src/styles.css`, section "Home page theme", and the Rita components), not
invented. When a design request conflicts with this file, say so first, then follow the owner's
decision and update this file.

Process for any design request: `docs/design-workflow.md`. Product context: `PRODUCT.md`.

## Identity

Clean white page, ink text, one pink action colour, dark top bar. Friendly and clear, never
generic SaaS. Rita herself carries the personality (the orb and the Little Light Wanderer);
the page stays calm around her. Arabic and English are both first-class (RTL per paragraph).

## Where it applies

Scope class `.edith-premium` (home, `/rita`, `/rita-live`, lesson screens, admin curricula).
Pricing, study and admin keep their own palettes unless the owner asks otherwise. New screens
on the Rita side must sit inside `.edith-premium` and use its tokens, never raw hex values.

## Tokens (use these, do not add look-alikes)

| Token | Value | Use |
|---|---|---|
| `--pp-ink` | `#121117` | text, borders on buttons, dark bar |
| `--pp-muted` | `#6a697c` | secondary text |
| `--pp-line` | `#dcdce5` | hairlines, input borders |
| `--pp-grey` | `#f4f4f8` | cards, inputs, quiet surfaces |
| `--pp-pink` | `#ff7aac` | the one action colour (primary buttons, selection) |
| `--pp-pink-hover` | `#fe9fc3` | hover of pink |
| `--pp-pink-text` | `#d13d76` | pink used as text/links (readable on white) |
| `--pp-pink-soft` | `#ffe5f0` | soft pink backgrounds |
| `--pp-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | all transitions |

Page `#fff`; dark device screen `linear-gradient(162deg, #26252e, #121117)`.

## Type

- Body and UI: Figtree. Headlines: Inter Tight, weight 700, letter-spacing `-0.035em`,
  `text-wrap: balance`. Arabic falls back to Noto Sans Arabic.
- h1 48/52 on phones, 64/68 from 1024px. h2 line-height 1.08.
- Body 16px minimum for anything the learner reads or types (no smaller inputs: iOS zooms).
  Helper text 12–14px only for secondary notes.
- Direction follows the content: `dir="auto"` on user/Rita text, per paragraph.

## Shape and spacing

- Radius: buttons and inputs 8px, cards 16px, sheets 24px (top corners on phones).
- Buttons: 2px ink border, pink fill, ink text, `.rita-btn` / `.rita-btn-primary` /
  `.rita-btn-secondary`, small `.rita-btn-sm` (40px). Selects: `.rita-select` (48px).
- Spacing on a 4px scale; sections breathe (24–48px), controls inside a card 8–16px.
- Windows: one level only (a sheet from the bottom on phones, centred on wider screens,
  max 672px). No window inside a window.

## States

Every interactive element has: default, hover (`--pp-pink-hover` or 8–14% ink tint), focus
(`focus-visible`: 2px ink or deep-pink outline, 2–3px offset), active (1px press), disabled
(opacity .4, not-allowed), loading (spinner, label kept), and an error/empty state with plain
words. Errors are shown, never swallowed.

## Motion

Short and quiet: 150–250ms with `--pp-ease`, transform/opacity only, always honouring
`prefers-reduced-motion`. Motion explains a change (open, close, state); it never decorates.
The orb is the only continuously moving element.

## Content rules

- Real copy for this product and this learner. No lorem ipsum, no "Unlock the power of…",
  no "Welcome to our platform".
- Short sentences. English UI strings in the current English voice; Arabic for explanations.
- Never promise persistence or success that the server has not confirmed.

## Do not (the anti-generic list)

Purple/blue gradient backgrounds, generic "AI" glow, glassmorphism without a reason, three
equal feature cards in a row as the default layout, icons inside tinted circles on every row,
decorative rounded corners everywhere, stock-photo heroes, fake testimonials or numbers,
random shadows, more than one accent colour, centre-everything layouts, cards for content
that is just a list, text under 12px, low-contrast grey on grey.

## Top bar and menus

One bar for the whole site (`ProHeader`, classes `.rh-bar*`, explicit colours so they look the
same on the cream pages and on the white ones). Dark ink `#121117`, 64px, no blur, no capsule.
Links sit next to the logo; the current page gets the hand-drawn pink line from the home
headline, drawn once. Guests get "Sign in" and one pink "Start learning" button. Signed-in
users get the Credits chip (Rita's small orb plus what is left; the orb ring turns amber below
20% and red when used up) and the avatar with a pink ring.

Menus are the white card with a 2px ink border (same as the home word card), 16px radius, no
window inside a window. Rows are 44px, bare ink icons, `--pp-pink-soft` on hover; one `rh-item`
style for every row. Credits bars show what is left (pink, amber under 20%, red at zero, and
the words "Used up"). Only one menu is open at a time; Escape and a press outside close it and
focus returns to the button. Opening is 160ms, `scale(.96)` from the button, off with reduced
motion.

## Study rooms (/learn and the room pages)

Same system as the home page, inside `.edith-premium`: white page, Inter Tight titles, one
pink action. `/learn` shows the three rooms as one dark, one grey and one wide white card, each
with its tools as small sticker chips. Inside a room, each column is a grey panel; every tool is
a white card with a 2px ink border, a bare ink icon, its name, one line and an "Open" row. No
photos or illustrations, no coloured strips, no labels above titles. Locked tools and rooms are
dashed and say "Coming soon". The Tutorial page was removed (`/tutorial` and `/tour` redirect
to the home page); the in-page "How it works" tours stay.

## Accessibility floor

Contrast AA (4.5:1 text, 3:1 large text and UI), visible focus, keyboard-reachable controls,
labels on icon-only buttons (`aria-label`), `role="status"` for live feedback, touch targets
at least 40px, nothing relying on colour alone, RTL checked on any new text layout.

## Checked views for every change

Phone 390×844, tablet 768, desktop 1280; Arabic (RTL) and English content; empty, one item,
many items and very long text; loading and error states.
