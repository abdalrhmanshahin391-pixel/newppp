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
- Small choice of two to four options (the live page's "Rita explains in"): `.rita-choice`, radio
  buttons in one row, 44px high, 8px radius, hairline border; the chosen one has a 2px
  `--pp-accent` border, `--pp-accent-soft` fill and `--pp-accent-text`. Arrow keys move the
  choice. Use it instead of a select when every option should stay visible.
  `.rita-choice-stack` stacks the same group in one column for longer labels (the "Report a
  problem" reasons under a Rita reply, which expand inline, never as a window).
- Admin quality screens (`/admin/rita-quality`): a row of four number cards (`--pp-grey`, 16px
  radius, value 34px/600, a muted note, and a change line that says "Better by"/"Worse by" in
  words, never colour alone), a list of problem cards (hairline border, title first, one meta
  line), and Rita's reply beside the reference reply (grey card next to `--pp-accent-soft` card,
  stacked on phones). Small samples are said out loud, not hidden.
- Admin tool screens (Rita quality and the admin strip): one blue primary action per view; everything
  else is `.rita-btn-soft` (hairline outline) or `.rita-btn-quiet` (no outline until hovered); icon
  buttons use `.rita-btn-icon` (44px square). Several secondary actions go into a menu (Radix
  DropdownMenu with the `rita-menu` look: 12px radius, 44px rows, a small grey line under each
  label) instead of a row of buttons. Sections are told apart by space and a hairline, not by
  different boxes. Tabs are an underline row (`.rita-tabs-list` / `.rita-tab`, 44px). A path of
  steps uses `.rita-stepper`. The strip only an admin sees is dashed (`.rita-admin-bar`) and says
  "Admin only". A row whose title is Arabic gets `dir="auto"` so the whole row reads right to left.
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

- **Top bar switcher** (`LanguageMenu`, signed-in learners only): on the dark bar, just before the avatar
  (on phones, just before the menu button), a 44px button with the flag of the language being learned
  and a chevron. With no language chosen it is an outlined pill with a globe and "Choose language"
  (icon only under 420px). It opens the same white menu card as the account menu (2px ink border,
  16px radius, 160ms): a small "Learning language" title, one 52px row per language (flag, own name in
  bold, name in the site's language, check on the chosen one, blue-soft fill). On phones the card spans
  the screen with 16px margins under the bar. One menu open at a time; Escape or a press outside closes
  it and focus returns to the button; choosing closes it and says "Now learning Deutsch" politely. The
  wide-screen and phone copies keep separate open states.
- **Flags** are decoration, never the only signal: a 4:3 picture, 4px radius, hairline ring (light on the
  dark bar), no text alternative because the name is always beside it. A language is not a country, so an
  admin picks the country (English: the UK by default). Pictures are self-hosted SVGs in `public/flags`
  (MIT, `flag-icons`); a language without a country, or a picture that fails to load, shows its code in a
  small grey tile. Only flags in `FLAG_COUNTRIES` are ever requested.
- **Settings and the first-time card** (`LanguagePicker`, `LanguageChooserCard`): the full list in Settings
  (`/profile`, first card, `#learning-language`) and a card on `/learn` that does not block the page.
- **List rows** are pressable, so 2px ink border, 16px radius, 56px minimum: the flag (32px), the
  language's own name (18px bold: "Deutsch"), its name in the site's language and a check. Selected =
  blue border, `--pp-accent-soft` fill and the check; no gradients, no icons in circles. The own-language
  name is wrapped in `<bdi lang>` so it follows the row's direction in Arabic and still renders in its own
  script. Rows are at most 36rem wide.
- **After a change** a polite status line says "Now learning Deutsch. Your other languages stay
  saved." Errors say what failed in plain words and keep the previous language.
- **`/learn`** shows "Learning Deutsch · Change" under the greeting (Change links to the Settings card).
- **Never** hide a language's content by deleting it: switching only changes what is shown.
- **Gates** (`LanguageGate`, `GermanOnlyGate`): a signed-in learner who has not chosen a language sees the
  chooser card in place of flashcards, Memory Lab, lessons and shared decks. A learner of another
  language who opens the German Lab sees a short notice with "Switch to Deutsch" and "Back to learning"
  (title in `rh-app-title`, grey panel, no dead end). Guests see the pages as before. The German section
  and its side-list item on `/learn`, and the footer link, only show for German learners (or before a
  choice).
- **Admin** (`/admin/languages`, Arabic, RTL): one card per language with its flag, "visible to learners",
  "Rita voice" and a country menu for the flag (names from `Intl.DisplayNames`), up/down order, counts,
  and an add form with a live flag preview. A language that has content is
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

## Lesson exercise window

Lessons with exercises (content version 2, `src/lib/rita-lesson-*`) run on the lesson engine. The
explanation of each part is a card in the conversation (`LessonFlow`): rule in Arabic, a two-column
table, examples, and "فهمت، يلا نتمرن" / "عندي سؤال". The questions open in a window over the page
(`ExerciseWindow`), never in the chat:

- Phone: a sheet from the bottom (24px top corners, up to 88% of the height). From 640px: a centred
  window, max 672px. Radix Dialog: focus moves into the window (to the window itself, so Enter
  cannot pick an answer by accident), Esc and the back button pause the lesson, never cancel it.
- Header: "الجزء 1 من 2 · تمرين", the part title, a thin progress bar and "سؤال 2 من 5", and a
  "إيقاف مؤقت" button. Paused, the window becomes a bar at the bottom ("التمرين متوقف · سؤال 2 من 5
  · كمّل") that reopens the same question.
- Choices: full-width rows (56px, 12px radius) with a number key 1–4; number keys answer. Tiles
  (word order, syllables): tap to place, tap a placed tile to send it back; no dragging needed.
- After an answer the question stays; a line under it says right or wrong with an icon and words
  (green `#1d6b3a` / red `#b3213f` on soft fills, never colour alone). A finished question stays
  1.6 s (or until "التالي") before the next one. The right answer is shown only once the question
  is finished, and the server never sends it earlier. A spelling item shows a clue, not the word.
- End of a part: "4 من 5", "صح من أول مرة، بدون مساعدة", one sentence and one button.
- Motion: 200–240ms rise (phone) or 220ms scale from 0.97 (wide), fade only under reduced motion.
- Arabic text with English words uses `ChatText`, so the words get the same chips as in the chat.

Admins make the exercises on `/admin/curricula` → lesson → "التمارين" (`ExercisesPanel`): one button
writes them from the lesson's pages, a second review lists warnings (amber, with the question id),
code checks list what blocks publishing (red), each question can be edited (JSON), replaced or
deleted, "معاينة كطالب" opens the lesson in preview, and "نشر للطلاب" publishes. Any edit returns
the exercises to a draft.

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
