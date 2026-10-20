# DESIGN.md — the visual system of EdithLab / Rita

This is the source of truth for every visual change. It was written from the code that is
already shipped (`src/styles.css`, section "Home page theme", and the Rita components), not
invented. When a design request conflicts with this file, say so first, then follow the owner's
decision and update this file.

Process for any design request: `docs/design-workflow.md`. Product context: `PRODUCT.md`.

## Identity

Clean white page, ink text, one blue action colour, dark top bar. Friendly and clear, never
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
| `--pp-accent` | `#2b6df0` | the one action colour (primary buttons, selection) |
| `--pp-accent-hover` | `#2260e4` | hover (a shade deeper) |
| `--pp-accent-text` | `#2563eb` | accent used as text/links (readable on white) |
| `--pp-accent-soft` | `#e7eefd` | soft blue backgrounds |
| `--pp-on-accent` | `#ffffff` | text on the accent (white, 4.6:1 on `#2b6df0`) |
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
- Buttons: 2px ink border, blue fill, white text, `.rita-btn` / `.rita-btn-primary` /
  `.rita-btn-secondary`, small `.rita-btn-sm` (40px). Selects: `.rita-select` (48px).
- Spacing on a 4px scale; sections breathe (24–48px), controls inside a card 8–16px.
- Windows: one level only (a sheet from the bottom on phones, centred on wider screens,
  max 672px). No window inside a window.

## States

Every interactive element has: default, hover (`--pp-accent-hover` or 8–14% ink tint), focus
(`focus-visible`: 2px ink or deep-blue outline, 2–3px offset), active (1px press), disabled
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
Links sit next to the logo; the current page gets the hand-drawn blue line from the home
headline, drawn once. Guests get "Sign in" and one blue "Start learning" button. Signed-in
users get the Credits chip (Rita's small orb plus what is left; the orb ring turns amber below
20% and red when used up) and the avatar with a blue ring.

Menus are the white card with a 2px ink border (same as the home word card), 16px radius, no
window inside a window. Rows are 44px, bare ink icons, `--pp-accent-soft` on hover; one `rh-item`
style for every row. Credits bars show what is left (blue, amber under 20%, red at zero, and
the words "Used up"). Only one menu is open at a time; Escape and a press outside close it and
focus returns to the button. Opening is 160ms, `scale(.96)` from the button, off with reduced
motion.

## Learning home (`/learn`)

One working screen for Rita and every study tool (the three room pages still exist at `/learn/study-space`, `/learn/study-room`
and `/learn/german`, but nothing on the home links to them). Structure follows a familiar app home, in this site's own look:

- **Top:** the title (greeting with the first name, a calm 28 to 40px, class `rh-app-title`) and one grey "Next up" panel with
  one blue button. The suggestion follows a fixed order (`src/lib/learn-home.ts`): a lesson already started, cards due,
  the next lesson, a talk with Rita; guests are asked to sign in. Nothing here is invented: no number or streak is shown unless it came from the account.
- **Three columns from 1024px:** a section list (anchors with the current one highlighted, plus Progress), the sections, and the
  "Today" panel (due cards, daily goal bar, streak, lessons done; loading, error with retry, empty and guest states).
  Below 1024px the list becomes a scrolling strip of 44px chips and "Today" sits above the sections.
- **Sections** are plain titles (no small capital labels) over a list of wide rows: Talk to Rita, Study with your own material,
  Plan your time, Study together, German. A row is one link with a 2px ink border (it is pressed), the picture slot on the
  inline-start side, the name, one line of text, an "AI" tag where the tool uses AI, and a live chip when there is real
  state ("10 due", "3 of 12 done").
- **Picture slots** (`ImageSlot`) are 128px squares (88px on phones). With no picture they are a dashed, labelled "Image here"
  square, so the gap is obvious. Pictures are added in `src/lib/learn-images.ts` by tool key; nothing else changes. One
  illustration family for all of them: flat vector with thick ink outlines and the site blue, like the lesson covers.
- Direction follows the language (logical padding, mirrored arrows). Every control is at least 44px. Motion is only
  press feedback (`scale(.99)`) and colour changes under 200ms.

## Learning language (chooser and switcher)

The learner is learning one language at a time; the whole site follows it (flashcards, lessons,
free conversation, shared decks). Do not call it "language" on its own: the site's own language
(English / Arabic) is a different setting.

- **One component, three places** (`LanguagePicker`): the list in Settings (`/profile`, first card,
  `#learning-language`), the first-time card on `/learn` (`LanguageChooserCard`, shown in place of
  nothing: the page stays usable below it), and a row of chips in the account menu.
- **List rows** are pressable, so 2px ink border, 16px radius, 56px minimum: the language's own
  name (18px bold: "Deutsch"), then its name in the site's language, a small code chip (EN, DE) and a
  check. Selected = blue border, `--pp-accent-soft` fill and the check; no gradients, no flags,
  no icons in circles. The own-language name is wrapped in `<bdi lang>` so it follows the row's
  direction in Arabic and still renders in its own script. Rows are at most 36rem wide.
- **Chips** (menu): 44px, same selected treatment, own-language name only.
- **After a change** a polite status line says "Now learning Deutsch. Your other languages stay
  saved." Errors say what failed in plain words and keep the previous language.
- **`/learn`** shows "Learning Deutsch · Change" under the greeting (Change links to the Settings card).
- **Never** hide a language's content by deleting it: switching only changes what is shown.
- **Admin** (`/admin/languages`, Arabic, RTL): one card per language with "visible to learners" and
  "Rita voice" switches, up/down order, counts, and an add form. A language that has content is
  disabled, not deleted.

## Study rooms (/learn and the room pages)

Same system as the home page, inside `.edith-premium`: white page, Inter Tight titles, one
blue action. `/learn` shows the three rooms as one dark, one grey and one wide white card, each
with its tools as small sticker chips. Inside a room, each column is a grey panel; every tool is
a white card with a 2px ink border, a bare ink icon, its name, one line and an "Open" row. No
photos or illustrations, no coloured strips, no labels above titles. Locked tools and rooms are
dashed and say "Coming soon". The Tutorial page was removed (`/tutorial` and `/tour` redirect
to the home page); the in-page "How it works" tours stay.

## Flashcards workspace (`/study`, `/study/match`, the card player)

One main action per panel, hierarchy by weight instead of by frame:

- **Panels are grey** (`#f4f4f8`, no border): the session panel (`LaunchPanel`, `GameSetup`) and the daily panel.
  Ink borders (2px) are for things you press: buttons, mode tabs, subject rows, menus. The page board itself has no frame
  (`StudyLayout framed={false}`); other study pages keep the framed board.
- **Session panel:** one solid blue button on top ("Smart review · N" when cards are due, "Study mode" when nothing is due),
  with a one-line hint under it, then two compact outline buttons side by side. The daily panel only shows its own
  "Review everything due" button when something is ticked, so the same action is never offered twice.
- **Subject rows** (`SubjectBoard`, `PickerBoard`): tick box 24px drawn, 44px hit area; the name may wrap to two lines (never
  cut to a few letters); count under the name; one "..." menu per row (rename, add sub-subject, move up/down, remove...).
  Move up/down is the touch way to reorder (native drag does nothing on iPad); the drag handle only shows with a mouse.
  Remove always opens the confirmation dialog.
- **Action column** (`Add subject`, `Edit`, ...): big tiles from 1024px; below that one short scrolling strip of 44px chips so
  the learner's subjects are on screen first. Mode tabs are "Study / Edit" on phones.
- **Memory Lab:** Play is directly under the pair count and says which game it will start ("Play Match"); the four games
  are a 2x2 choice; the two switches say what they do in one line.
- **Card player:** progress bar and "1 / 6" at the top, the side label ("Question" / "Answer") is a readable chip, the hint
  text follows the device ("Tap the card to flip, swipe to move" on touch; Space and arrows with a mouse), 56px controls.
- Every control is at least 44px, every text at least 12px and 4.5:1 (muted text is `#4b4a5c`, not the old light greys).

## App pages (every page except the home design pages)

Every page outside `/`, `/rita*` and `/learn*` was written with fixed warm colours. They take the
home look through a scope class, `.rita-app` (set in `__root.tsx`, also on `<html>` so dialogs
inherit it): the tokens, the Figtree / Inter Tight fonts, the blue 8px/2px-ink buttons, and a block
in `styles.css` that maps each old hex utility class (`text-[#23201d]`, `bg-[#8ec63f]`, ...) onto
the palette by role. Tailwind palette classes (`bg-emerald-600`, `text-rose-700`) follow the same
roles through `--color-*` overrides: greys stay grey, red and green only mean wrong / right, warm
tones mean caution and every other hue is the blue accent. Delete the block to go back to the
old look. Shared frames are hand-built: `StudyLayout`, `LaunchPanel`, `SubjectBoard`,
`SessionStarter`, `DailyPanel`, the dialogs, the sign-in dialog and the Memory Lab rounds. Rules:
white page, grey panels, 2px ink borders on anything you press, blue only for the action and the
"on" state, green/red only as right/wrong feedback, no tinted icon circles, no capital-letter
labels, no stock illustrations. Question bank, Lecture Lab and All in one follow the same rules:
the question player, map rail, explanation panel and subject picker are ink-bordered cards with
the accent for the action.

## Lesson builder (`/admin/curricula`)

For one book the admin sees: "Lesson N: pick its topic" (three cards from the pages already read,
plus a field for a topic of their own), then a rail of the book's lessons and, for the chosen
lesson, three tabs: Overview, Slides and Goals and plan. Slides are written by the AI from the
lesson's own pages (6-9 slides: title, points, examples, vocabulary, a practice task, a recap),
then edited by hand: thumbnails strip, live preview, up/down/delete, add, save. Slides are for
admins only for now and live in their own table (`rita_lesson_slides`), so the page works before
the migration is applied. Pure rules (slide schema, next-topic suggestions) are in
`src/lib/rita-slides.ts` with tests in `rita-slides.test.ts`.

### Lesson resources (fourth tab: Resources)

Optional study material per lesson: a summary PDF, a helper video, a link (up to 12). One calm
screen: a PDF drop area and a link field side by side; picking either opens a small form (title
prefilled from the file name or the host, optional "when to use it" note, link/video choice),
then the list. Each row is a 2px ink card with a square icon (no tinted circles), title, type and
size or host, and icon buttons: open, edit, up, down, delete (delete asks inline first). On a
phone the buttons drop under the text so long titles never get squeezed. The learner sees the same
items as a "Lesson resources" list under the lesson goals in the live room: whole row is the
link, opens in a new tab, never required. PDFs are in a private bucket; links expire after an
hour. Only `https` addresses are accepted. Rules and tests: `src/lib/rita-resources.ts`.

### Lesson card on the map (`/rita-lessons?lesson=…`)

Tapping a lesson that has shared slides or resources opens a card instead of starting the lesson
(a lesson with neither starts straight away, as before). Phone: a sheet that rises from the
bottom; desktop: a centred card. Header: round picture, Arabic and English title, stars, close.
Tabs (only those with content, each with a count): Overview (what you will learn, plus two big
rows that jump to slides and resources), Slides, Resources. The primary button "ابدأ الدرس / تابع
الدرس / أعد الدرس" is always at the bottom; looking at slides or resources records nothing. The
slide viewer shows one slide at a time with next/previous (arrow keys and swipe follow the right
to left reading direction), a thin progress bar and "3 / 8"; on the last slide next becomes
start. The map marks such lessons with a small ink-bordered badge (file icon and a count) at the
lower right of the circle. Slides are AI drafts, so an admin switches "show to learners" on per
lesson; regenerating switches it off. The card is a modal: Esc and back close it, focus is kept
inside and returned, the page behind is locked, motion stops under reduced motion.

## Home app window

`AppWindow.tsx` replaces the old lesson-path strip. A window built from real markup (no screenshots) that starts tilted (desktop only) and flattens as it scrolls to the middle of the screen, then plays a short story once: the path fills, the lesson in progress shows, two words are saved, Rita listens.

- Only `transform` is written on scroll (one rAF, no state); the story uses transitions. The wave on Rita's bar runs four times, then stops (the orb stays the only continuous motion).
- Calm motion and no-JS show the finished window flat. Replay is a 44px button.
- Content is sample content and says so ("Sample screen", "Sample lessons and words"). No counts, no users, no testimonials.
- Decorative for assistive tech: `aria-hidden` plus a one-paragraph `sr-only` description.

## Home "Under the hood" band

`src/components/home/procreate/UnderTheHood.tsx`, after the lesson path. Speed story for Rita, told in three parts: a scripted mixed-language transcript demo, an overlap timeline, and five capability cells (one is the measured figure).

- Honest numbers only. The one measured figure (about 75 ms) is the voice engine alone, with its date, region and "not end to end" stated next to it. Latency goals are not shown on the page; add an end-to-end figure only when recorded calls back it.
- Every number is defined where it appears (what is measured, from where to where).
- The demo is labelled as a scripted example. It has a Replay button, a full-text `sr-only` version, and shows the whole text at once under reduced motion.
- Mixed-direction text is grouped by language into `dir`/`lang` spans so Arabic never reorders neighbouring words.
- No vendor names and no compliance claims on the page.

## Accessibility floor

Contrast AA (4.5:1 text, 3:1 large text and UI), visible focus, keyboard-reachable controls,
labels on icon-only buttons (`aria-label`), `role="status"` for live feedback, touch targets
at least 40px, nothing relying on colour alone, RTL checked on any new text layout.

## Checked views for every change

Phone 390×844, tablet 768, desktop 1280; Arabic (RTL) and English content; empty, one item,
many items and very long text; loading and error states.
