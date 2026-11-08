# DESIGN.md — the visual system of Uzyra (formerly EdithLab) / Rita

## Study circle: five help services and two practice tools

The existing draggable study circle offers «اشرحلي», «معنى ونطق», «فكّك الجملة», «ليش هيك؟» and «انتبه للغلطة». Explanation uses a white
disc with an ink icon; meaning uses the blue action disc. Both inherit the radial opening,
labels and selection strip. Unsuitable selections leave the service visible but disabled.
Explanation language is a labelled tool in the selection strip. «فلاش كاردز» and «تمارين اختيار»
follow the five help services, using the existing stacked-card and checklist icons. The temporary
question preview is not an entry. All seven are reachable through existing «المزيد» pagination.

Practice reuses the selection-based generators and their authentication, quotas and validation.
Results open in a single white workspace (maximum 672px), a bottom sheet on phones, with the
existing typography and blue action colour. Cards reveal their answer and optional note and
have previous/next controls. Each question has four options; choosing one locks the answer and
shows the correct choice and reason in text, never colour alone. Navigation retains answers.
Loading, server errors, empty results and retry remain visible. Retry uses the original selection,
and duplicate generation is blocked. Closing does not reopen automatically when generation ends;
«آخر تدريب» in the header reopens it. Results remain only for the current lesson visit. Escape
or close restores focus to the circle. No new database storage, worker action or transport.

«اشرحلي» answers only the selected part in one to three short sentences and at most one example.
It asks no check question and never asks the learner to explain back. The live voice version
speaks one short sentence, with a tiny written sheet only when needed.

«معنى ونطق» accepts a short English/German word or phrase from the guide. Its non-modal white
card stays inside the work area (340px maximum, 18px inset, 16px corners, a restrained shadow).
It shows the phrase, one Arabic meaning for this sentence, and one 44px «اسمع النطق» button.
Loading, retry and audio failure stay in the card. Escape or its close button dismisses it
and returns focus to the circle. Closing stops audio. Opening the circle or requesting an
explanation dismisses the card. Reduced motion removes its entrance. Contextual meanings are
cached by phrase and context; audio stays shared by phrase. Pronunciation uses the existing
voice/microphone guard, so the clip is not heard as the learner.

«فكّك الجملة» groups a selected sentence or phrase into meaningful grammatical parts, keeping
verb groups and fixed expressions together (She | is reading | a book). The text reply gives one
short line per part; the voice reply gives one short sentence with a small table in its sheet.
«ليش هيك؟» accepts a selected word or short form and explains its reason in the surrounding
sentence in one to three short sentences (one spoken sentence). It never invents a reason when
the supplied context is insufficient. Both use the existing request lifecycle and explanation
language; neither quizzes the learner. Unsuitable actions have a specific accessible hint, and
the selection strip explains when a word or a sentence should be selected.

«انتبه للغلطة» uses the existing outlined triangle and dark service disc, with no error-red
judgement of the learner. From a selected rule, sentence, phrase or related table cells it gives
exactly one preventive example: «الغلط»، «الصح»، «السبب», one short line each. The pair differs
only in the target mistake. It never calls correct selected text wrong, quizzes the learner, or
invents an example when the guide context is insufficient. Arabic rules are supported too.
In a call it speaks one short warning and puts the same three lines in a small written sheet.
All five services share the existing loading, stop, retry and request-replacement behaviour.
When all seven cannot fit around the saved circle position, the existing «المزيد» pagination
keeps the remaining services reachable; touch targets and labels keep their established sizes.

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
  `text-wrap: balance`.
- Arabic: Graphik Arabic (Commercial Type, licensed by the owner), our own files in
  `public/fonts/arabic` (400 and 700; 500 shows as 400, 600 and up as 700). It is the family
  "Uzyra Arabic", limited to the Arabic Unicode ranges and first in every font stack, so Arabic
  letters always use it and Latin letters fall through to Figtree / Inter Tight. Never name another
  Arabic face (no Noto, no system fallback). The guide sheet and its PDF keep their own embedded
  Noto Sans Arabic so the page and the PDF stay identical. Any new font file must pass the browser
  font sanitizer (OTS; Firefox drops a layout table it rejects, which loses the mark placement): the
  Graphik files were rebuilt with fontTools so their coverage tables are sorted.
- h1 48/52 on phones, 64/68 from 1024px. h2 line-height 1.08.
- Body 16px minimum for anything the learner reads or types (no smaller inputs: iOS zooms).
  Helper text 12–14px only for secondary notes.
- Direction follows the content: `dir="auto"` on user/Rita text, per paragraph.

## Shape and spacing

- Radius: buttons and inputs 8px, cards 16px, sheets 24px (top corners on phones).
- Buttons: 2px ink border, blue fill, white text, `.rita-btn` / `.rita-btn-primary` /
  `.rita-btn-secondary`, small `.rita-btn-sm` (40px). Selects: `.rita-select` (48px). On the
  home page and the app pages the calm scale applies (see "App pages": 42px / 1.5px / 15px).
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

## Name and logo

The site is called **Uzyra** (name only; Rita and ritajet.com stay). The logo is the owner's symbol (five
solid shapes, `UzyraMark`) beside the name in wide-tracked capitals with an A drawn without its crossbar
(`UzyraWordmark`, Outfit 600, tracking 0.2em). On the dark bar and footer both are **soft white**
(`#f2f2f5`, token `--uz-logo`), never pure white; on light pages (sign in, register) they take the ink
colour. Use `BRAND_NAME` from `src/lib/brand.ts` in code, never a typed name. The app icon is the soft
white symbol on the dark ink square (`#121117`), full-bleed for Apple, rounded for the tab and the app list.

## Guides (PDF)

Printed grammar guides, one rule per page, in a booklet size (439 x 621 pt). Admin only for now. The
content is data (`src/lib/guides/guide-content.ts`); the look is one template
(`src/lib/guides/guide-html.ts`), so a guide never carries layout or colour.

- **Header:** the title in capitals (Inter Tight 700) on the left; the Uzyra symbol and name on the right
  in ink (no Rita face); a 1pt hairline under it.
- **Body:** Figtree 10 to 11pt. The taught term is blue (`#2b6df0`), bold, italic. Section headings are
  blue and centred ("Form", "Usage").
- **Tables:** header cells are pills: neutral (grey), positive (green), negative (red), question (blue).
  The word is always printed, so meaning never depends on colour (it prints well in black and white).
  The tense matrix uses solid blue column pills and solid green row pills (white text, contrast 4.5:1 or
  more). A row never splits across pages; a long table repeats its header.
- **Cards:** "Usage" is `#eaf1ff`, the closing reminder is `#f4f4f8`, both 12pt corners. Examples are
  italic with the stressed form in bold.
- **Arabic note:** a thin bordered box tagged AR, right to left, Noto Sans Arabic, plain Arabic; Latin
  words inside it keep their own direction.
- **Footer:** "Uzyra · Grammar guide" with "draft for review" until the owner approves, and the page number.
- **Fonts** (all OFL, in `guides-worker/fonts`): Figtree, Inter Tight, Outfit, Noto Sans Arabic; embedded.
- **Admin screen** (book workspace, step 2 "الدروس", `GuidesPanel`): next to "اصنع الدروس المختارة" there is
  a soft button "اصنع دليل PDF (N)" for the ticked suggestions; below the list an always-visible section
  "أدلة PDF" lists every guide, newest first: title, a chip (مسودة / جاري العمل / ما زبط), pages, review
  notes and the version, with فتح (primary) · تنزيل · أعد الصنع. Progress shows on the lesson's own row while
  it is made. Files are admin only (private bucket, one-hour links); learners never see them.
- **Never** copy another publisher's logo, mascot, wording or examples; the structure is ours to reuse,
  the content is written fresh and checked by a teacher before approval.

## Closing footer

The global footer uses the ink surface and existing soft-white Uzyra mark. Five
groups of real links and the existing legal destinations stay available. Short
opening copy and Start learning sit beside the links on desktop; on phones they
stack above two link columns. A large decorative Uzyra wordmark closes the page,
with one thin blue learning thread behind its letters. Existing bundled Noto Sans
Arabic supports Arabic copy. No new font assets, image downloads, scroll listeners
or automatic animations. Links have 44px hit areas,
readable muted text, visible focus and RTL layouts. Full-screen study keeps its
footer exclusion.

The study header keeps Back to lessons and optional PDF download. The lesson
title and admin-preview notice remain available to screen readers. Visible sample
headings, sample-switch and challenge shortcuts are removed. Idle copy below Rita's
cube is omitted; connecting, failed and active statuses remain visible.

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

One section at a time: Talk to Rita, Study with your own material, Plan, Together and German
(the last follows the learning-language visibility rule). From 1024px, a sticky section rail
sits beside the content; below it, a horizontal strip with 44px targets. Arabic mirrors the
layout. Real due-card and lesson counts remain optional account data, never invented.

- **Monochrome:** flat black cards (`--uz-tile-bg: #000`, matching the existing monochrome WebP
  artwork), soft-white foreground (`--uz-paper: #f2f2f5`) and readable neutral secondary copy
  (`--uz-on-tile-muted: #b9b9c2`). The selected rail entry uses the existing ink token and white
  text. This exception is local to `/learn`; other screens retain their existing action colour.
  No gradients, image blending, animated shadows or continuous decorative motion.
- **Hierarchy:** the conversation stage and Lessons sit together; the other sections retain
  their existing leading tile and smaller tool tiles. Every destination, description and AI
  marker stays. Cards have 24px corners; button styling reuses the existing system in monochrome.
- **Navigation:** selection is immediate, followed by one interruptible-by-replacement 150ms
  entrance (opacity .85 to 1, translateY 2px to 0); no tile delays. Reduced motion removes it.
  Previously visited content stays mounted with `hidden` and `inert`, so its images and DOM are
  reused without making hidden links reachable. Unvisited content is not rendered or fetched.
  This cache is bounded by five small sections (13 existing images in total).
- **Address and scroll:** `#study` and other section fragments survive reload and browser
  back/forward. Panel IDs have a prefix to avoid native anchor jumps. Selecting a shorter panel
  after scrolling positions its top beneath the header; height is not animated. A minimum
  content area keeps the footer below the working area on short sections.
- **Images:** existing 512px monochrome WebPs, explicit dimensions/aspect ratios, eager loading
  for the leading visible illustration and lazy loading for the rest. No new image/font assets.
  Data hooks stay in `LearnHome`; local selection and reusable UI live in `LearnHomeView`.
- Verify Arabic/English at 390, 768, 1180 and 1280px, long count labels, 320px and the CSS viewport
  equivalent of 200% zoom, rapid navigation, keyboard, slow images and reduced motion. Isolated
  Chromium/WebKit checks and comparison captures: `scripts/check-learn-navigation.mjs`.

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
to the home page), and so were the in-page "How it works" tours (Nov 2026): pages explain
themselves with their own labels and hints, not with an overlay tour.

## Flashcards workspace (`/study`, `/study/match`, the card player)

One main action per panel, hierarchy by weight instead of by frame:

- **Panels are grey** (`#f4f4f8`, no border): the session panel (`LaunchPanel`, `GameSetup`) and the daily panel.
  Ink borders (1.5px on the calm scale) are for things you press: buttons, mode tabs, subject rows, menus. The page board itself has no frame
  (`StudyLayout framed={false}`); other study pages keep the framed board.
- **Session panel:** one solid blue button on top ("Smart review · N" when cards are due, "Study mode" when nothing is due),
  with a one-line hint under it, then two compact outline buttons side by side. The daily panel only shows its own
  "Review everything due" button when something is ticked, so the same action is never offered twice.
- **Subject rows** (`SubjectBoard`, `PickerBoard`): tick box 24px drawn, 44px hit area; the name may wrap to two lines (never
  cut to a few letters); count under the name; one "..." menu per row (rename, add sub-subject, move up/down, remove...).
  Move up/down is the touch way to reorder (native drag does nothing on iPad); the drag handle only shows with a mouse.
  Remove always opens the confirmation dialog.
- **Action column** (`Add subject`, `Edit`, ...): big tiles from 1280px; below that (tablets too) one short scrolling strip of 44px chips so
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

**Calm scale (Nov 2026, same as the home page).** Smaller, lighter words and more room, not a
smaller page: the root size and the user's zoom are never touched. In `.rita-app`:
- Header: 60px bar, 14px links, 38px buttons (the same rule as `.uz-home` / `.uz-learn`).
- Tailwind's big named sizes are lower (`--text-2xl` … `--text-7xl` = 22 / 26 / 30 / 36 / 40 /
  44px), so a page title lands at 30–44px instead of 48–72px; base and smaller sizes are
  unchanged. A bold `h1` is drawn at 600.
- Buttons: `.rita-btn` 42px, 1.5px border, 15px; `.rita-btn-sm` 38px, 14px.
- Mode tabs 52px, action tiles 56px (44px chips below 1024px), 1.5px borders, 12px radius.
- In a page's own markup: titles 30–40px semibold, card titles 14–15px semibold, hints 12px,
  big numbers 30px semibold, buttons 44px (`h-11`) with a 1.5px border and 14px text; small
  tick boxes keep their 2px border so they stay visible.
Pages with fixed pixel sizes (`text-[44px]`, `clamp(...)`) are brought onto this scale one group
at a time (flashcards first, then the study tools, the German Lab, account / pricing, admin).

## Library (`/books`, `/admin/books`)

Real books grouped on shelves, a little more colour than the other app pages but the same calm,
serious system (white page, ink, the home calm scale). Colour comes from the covers and from each
category's own tone, used only as a dot on its chip, a small tinted icon square and a thin line
under its shelf (8 fixed tones in `src/lib/books.ts`). No points, coins, streaks or hearts.

- **Top:** a small eyebrow, the title (28–38px semibold), one lead line; a 48px search field
  (1.5px ink border, «/» jumps to it) and a «فلترة» button that opens a grey panel of chips
  (level A1–C2, language, length short/medium/long, order). Category chips under it, each with its
  dot and count; the chosen one is ink.
- **Book of the week:** one grey panel with a soft tint of its category, the book large, a tag,
  title, author · year, chips (level in ink, pages, about N hours, language), three lines of
  description and «افتح الكتاب».
- **Shelves:** «وصل جديداً» (from six books on), then one per category in the admin's order, then
  «كتب ثانية» for books without a category. A row scrolls sideways with snap; «عرض الكل» filters.
- **The book object** (`BookObject`): one frame for every book — 2:3 cover with 3/8px corners, the
  binding's shadow on its left edge, a sheen, page edges under and beside it, a soft shadow on the
  shelf, the level on a white tag. Only the cover picture changes; without one the cover is cloth in
  the category tone with the title between two thin rules. Title 14.5/600 (two lines), author 12.5.
- **Search or filters** replace the shelves with a grid and a count; an empty result says so with
  «امسح البحث». The filters live in the address (`?q=&cat=&level=&lang=&len=&sort=`).
- **Details** (`BookSheet`): a dialog (a bottom sheet on phones) with the book, its facts and
  «ابدأ القراءة», which opens the PDF through a ten-minute signed link (visitors are asked to sign
  in; without a file the button says the file is not ready).
- **Admin** (`/admin/books`): categories (Arabic and English names, tone, icon, order) and books
  (cover JPG/PNG/WebP up to 5 MB, PDF up to 50 MB, category, level, language, pages, year,
  description, published, book of the week — one at a time), with a live preview of the book.
- Data: `book_categories` and `books` (migration `20261108120000_books_library.sql`), covers in the
  public `book-covers` bucket, PDFs in the private `book-files` bucket. Everyone reads categories
  and published books; only admins write.

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

## Curriculum admin (`/admin/curricula`)

A list of books, each a card with four steps under it (قراءة · دروس · مراجعة · نشر, `.rita-stepper`)
and one button for its next step. A book opens one step at a time (the step is in the address):
1. Read: one "اقرأ الكتاب كامل" button and a progress bar; page detail is folded away; a problem
   shows as one sentence with what to do.
2. Lessons: the suggested lessons with checkboxes (topic editable with the pencil), and the kind of
   the new lessons as two cards (below). One button makes the chosen lessons, with progress per
   lesson; can be stopped and resumed. "اصنع دليل PDF" makes guides on their own, listed below with
   open / download / make again.
3. Review: one row per lesson with its kind and a state chip (جاهز / فيه ملاحظات / فيه مشكلة / بدون
   تمارين / منشور), a filter الكل / درس ريتا / ملف + ريتا; a row opens the lesson in a side window
   (`.rita-drawer`: full screen on phones, a panel from the left edge from 640px) with tabs for
   exercises, plan, slides, resources and the kind.
4. Publish: one button publishes the book and every ready lesson; lessons with problems are named
   and left out; the learner path order is folded below.
Rarely needed tools (language, chosen page range, summaries, JSON import) sit in a dashed, folded
"أدوات متقدمة". Mixed Arabic/English titles use `BidiText` so English punctuation stays in place.

### The two lesson kinds: red and green

Every lesson is one of two kinds, and one colour marks it everywhere on the book page (tokens
`--kind-*` in `src/styles.css`, section "The two lesson kinds"):
- Red (`--kind-classic` `#d6453a`, text `#a3261c` on `#fdeceb`): "درس ريتا", Rita's lesson with
  exercises, as lessons always were. The default for new lessons.
- Green (`--kind-study` `#1f9d55`, text `#136c3c` on `#e4f5eb`): "ملف + ريتا", the PDF guide on the
  right and Rita on the left. One press makes it in full: the lesson, its exercises, its guide, then
  the guide checked and linked, with the steps shown under the row (`.uz-pipe`). Rules:
  `src/lib/study/lesson-maker.ts`.
The choice is two cards (`.kind-card`, a small picture each: chat lines for red, a page beside Rita
for green); a lesson carries a pill (`.lesson-kind`) and its row a 4px edge (`.lesson-row`). A green
lesson whose guide is not linked says "بدون دليل مربوط" and offers «كمّل» (learners get the red lesson
until it is linked). The kind can be changed later in the lesson window, tab «الدراسة التفاعلية».

The study page's Rita column (`.uz-rc-*`, RitaRealtimeV3 in study mode) follows the ChatGPT / Claude
chat pages, measured from the owner's reference and scaled ×0.82 so the column keeps that calm,
large-screen feel. Page #F7F7F6. Before the call: the UZYRA wordmark and Rita's cube big in the
middle, and no message field yet: at the bottom an 84px black circle with the white Uzyra mark
(30px; `HoldToStart`, «اضغط مطوّلاً لتبدأ» under it in 12px #8A8A87). The call starts only by holding
it: held (pointer, or Space / Enter), a white disc grows from its centre to the edge in 950ms (only
its transform moves; the mark turns black where the white covers it) while the circle gives 5%, and
a soft tone (a root and its fifth) rises in pitch and volume with the fill; let go early and the disc
shrinks back in 420ms, the tone falls away and nothing happens. Full, a small rising chord plays, the
circle shrinks away (scale 0.6, fades), a thin 40px ring turns in its place while the call connects
(the same 128px height, so nothing moves), and once Rita is connected the composer rises into that
place (460ms). After a failed call the circle comes back empty with «اضغط مطوّلاً لتعيد الاتصال».
Reduced motion: the circle does not shrink and nothing rises; the disc still grows. When the call starts the cube flies down to
sit just above the composer (FlyingCube). Rita writes without a bubble: a quiet 12px line first (her mark in a 26px white circle,
«ريتا», the circle request it answers, and on the newest answer what she is doing now) over a hairline
#E4E4E1, then 13px text #2B2B2B at 1.95 line height, paragraphs 12px apart, bold #161616. Words in the
language being learned are small grey tags (#ECECEA, 0.9em). The learner's words sit on the other side
in a #EBEBEA bubble (radius 15, 8×16 padding, 13px); a circle request shows its label as a small tag
above the quote. Turns are 26px apart; the report link is a small flag. The composer copies the
owner's reference chat box: one #EBEBEA field (radius 28, 16×14×12 padding, no border, no shadow),
the 16px field on top (16px keeps iPad Safari from zooming), then a 46px row with «كلماتي» (36px tall,
14px, and its count) at the start and, at the end, stop, end call and mic as plain grey 36px icons
(end call turns red only on hover) and a 44px round blue send (#6096F0, #A9C4F7 while empty). Rita's sheet is a #EFEFED card (radius 16, no shadow)
with white table cells, soft guide-tone head pills and a white «انتبه» tile.
Rita's cube (RitaCube) is a flat black block (no shading, no
shadow; a touch wider than tall, slightly uneven corners) with two white rounded eyes, alive from
springs that overshoot and settle: waiting, it does a small random action every 2–4 s (a hop with
anticipation, squash and stretch, a double bounce, a lean, a wiggle, a glance) and blinks fast; it
squashes hard with the learner's voice, rocks with circling eyes while thinking, hops on the beats of
Rita's voice, and hops on every change of mood; only the blink stays with reduced motion.
circle («لغة الشرح» opens three choices, the current one ticked).

## Language-change splash (`LanguageSplash`)

When a signed-in learner changes the language they are learning (top-bar menu, settings, first
choice), a full-screen white moment plays for about 3.4 seconds. It is only a picture: the change
has already happened, nothing waits for it, and a tap anywhere or Escape closes it.

- White page, ink text, one blue accent, no glow, almost no words: only the word and the language.
- "Uzyra" is set in Instrument Serif (`public/fonts/brand`, family "Uzyra Serif"), a serious
  display serif, never a script or signature face. Letter-spacing +0.07em and a thin ink stroke
  (1.6px phones, 2.2px wide) make it read clearly. Always left to right, even on Arabic pages.
- Motion, in order: the letters rise one after another, each coming out of a light blur (0.9s,
  110ms apart); a 3px blue line opens from the middle (0.7s); the language being left (grey flag,
  its own name) rolls up and out while the new one (flag, its own name in Inter Tight 700 32px)
  rolls in from below. The first choice has no old language, so only the new one rises.
- Only transform, opacity and filter move. The font is loaded first (at most 500ms) so the word
  never shows in another face.
- Reduced motion: a still card for 1.2 seconds. Hidden from screen readers (`aria-hidden`); the
  switcher's own announcement ("Now learning …") stays the spoken part.
- State and rules: `src/lib/language-splash.ts` (tested); it is started from `setLanguage` in
  `useLearningLanguage`, so every place that changes the language gets it.

## Entering a lesson (`LessonIntro`)

Opening a lesson (`/rita-study`, and the admin's sample at `/admin/study-sample`) shows no spinner.
The language-change picture in its dark form plays instead: UZYRA drawn in fine white lines on deep
navy (0.8s per letter, 80ms apart; the letters spread from the centre with a transform, never by
animating the gap) and a hairline opening under it at 0.85s (the same `LETTERS` and `.uz-splash`
pieces). A soft sound starts with it (filtered noise rising, then an open chord as the line opens;
generated in `tech-sound.ts`, off when the study page's sound is off; Safari plays it only when the
tap that opened the lesson woke the sound, so a direct visit is silent). The lesson's name rolls in
under the line with the word: at 0.45s when it is already known (the tap in the lessons list hands
it over), otherwise as soon as it arrives: «الدرس» (12px), its title (22px Inter Tight, white), its
Arabic title (15px, grey) when it differs, and one small dot per section of its guide once the guide
is here. Still waiting 0.45s after the word is drawn, a thin 132px bar with a light sliding along it
and «جاري تجهيز الدرس…» (12px) fade in under the title; it always holds its place, so nothing moves.
After 12s without the lesson, or on an error, the intro says so with «جرّب كمان مرة» (white pill,
asks again) and a way back.

Loading: the lesson starts loading the moment it is tapped, or when its card opens
(`src/lib/study/lesson-entry.ts`), not after the lesson page and sign-in have settled; the page
reuses that request. A lesson opened once is kept for 5 minutes in the tab (an admin preview for
15s), and a failed request is never kept. On the server the lesson, the study switch and the admin
check go out together, so the lesson waits for two database round trips.

Smoothness rules: the study page underneath is not built until the word is drawn and the title has
started rolling in (`onDrawn`), because building it would stall the line drawing; the intro then
leaves once the page reports its guide drawn (`pageReady`), after at least 0.7s on the title and at
most 2.6s after the lesson arrived. Leaving, the word, title and bar fade first (150ms), then the
navy (280ms), so the big letters are never seen half-transparent over the page. With the CPU slowed
4x a whole entry takes about 2.2s and no frame stalls while the letters draw. The admin's sample page
shows the same intro (with the bar) while the sample is prepared and the lesson page carries it on
from the same moment (`--lintro-t`) instead of drawing again. Reduced motion: no drawing, the words
simply show, the bar slides slowly, and it leaves after 0.5s. It is a `role="status"` region that
says the lesson's name.

## Home scale (`.uz-home`, first screen and header)

A calm technical workspace: the large, heavy pieces are smaller and lighter instead of shrinking
everything (owner's UI research, Nov 2026). Values live as variables on `.uz-home` (the home page's
`<main>`), so the shared header and buttons keep their sizes on other pages. The root font size and
the user's zoom are never changed.
- Headline: `clamp(2.25rem, calc(1.25rem + 3vw), 4rem)`, weight 600, line height 1.05, tracking
  -0.03em (36px at 390, ~51 at 1024, ~63 at 1440). The general `.edith-premium h1` size rule leaves
  `.rh-hero-title` out, so no `!important` is stacked; check with `getComputedStyle` after a change.
- Lead text 16px (17 from 768), line height 1.6, at most 36rem wide.
- Hero buttons 42px tall, 15px text, 1.5px border.
- Header on the home page: bar 60px, links 14px weight 500 (44px target kept), its button 38px.
- Rita's orb 280px (380 from 768) on a stage 320/360px tall and at most 840px wide; rings 1px.
  The orb sits in a positioned wrapper (the orb itself is `position: relative`).
- Word tags around the orb: 14–17px, weight 600, 1px border, radius 12, a 44px touch area.
- The hero is `dir="ltr" lang="en"` (its words are English), so punctuation stays right in Arabic.
- Below 360px the header spacing tightens so the logo, the button and the menu fit.
- The sections below (topics, three features, voice band, sample app window, under the hood,
  questions, closing invitation) share `.rh-h2` (`clamp(1.75rem, calc(1.2rem + 1.4vw), 2.25rem)`,
  weight 600: 28px on phones, 36 from ~1200), `.rh-h3` (17/18px, 600) and `.rh-lead2` (the lead
  size). Their buttons are the hero's 42px. Borders 1px (path rings 1.5px), card corners 16 (inner
  tiles 12), headline-to-content 32–40px, section gaps 64/96px, dark bands 48/64px inside. The sample
  app window stays labelled «Sample screen». Body copy 15–16px; eyebrow labels 13px.


`AppWindow.tsx` replaces the old lesson-path strip. A window built from real markup (no screenshots) that starts tilted (desktop only) and flattens as it scrolls to the middle of the screen, then plays a short story once: the path fills, the lesson in progress shows, two words are saved, Rita listens.

- Only `transform` is written on scroll (one rAF, no state); the story uses transitions. The wave on Rita's bar runs four times, then stops (the orb stays the only continuous motion).
- Calm motion and no-JS show the finished window flat. Replay is a 44px button.
- Content is sample content and says so ("Sample screen", "Sample lessons and words"). No counts, no users, no testimonials.
- Decorative for assistive tech: `aria-hidden` plus a one-paragraph `sr-only` description.

## Learning home scale (`/learn`, `.uz-learn`)

The same calm scale as the home page: the heavy pieces smaller and lighter, nothing shrunk below
reading size. The header takes the home page's lower bar (60px, 14px links, 38px buttons). Rail:
14px/600 pills (still 44px tall, the touch target), an 11.5rem column from 1024px. Section titles 22/600. "Talk to Rita" stage:
30px title on phones, 36px from 768px (weight 600), 15px line, 42px button, 320/340px tall, orb
100px. Tiles: names 16/600 (the lead tile 20), lines 14px, tags 11.5px, 22px corners, 32px go
button, 40px light buttons. Measured at 1180px: stage title 46 to 36, rail 16 to 14, tile name 19 to
16, header 64 to 60.

### Home hero words

Tapping one of the words around Rita's orb (Guten Morgen, Danke…) plays a small sound from the
study circle's family (`wordTapSound` in `tech-sound.ts`: a soft falling "pop", then two bell notes a
fifth apart, each word on its own pitch, so tapping them in turn plays a little tune) and the word
gives a springy pop (the `scale` property, so its tilt stays). The sound follows the same on/off
setting as the study page; reduced motion keeps the word still.

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

## Lesson path (`/rita-lessons`, `LessonPathView`)

A zig-zag road of round stops on white, with only what the learner needs on arrival: the header
(back, the language and level, a small «ترتيب حر» pill that opens every lesson in any order, and for
admins «تعديل المسار»), the title «دروسك مع ريتا» (24/600), and the road. No stars, stats card,
colour legend or slogan on this page (stars are still kept in the database). Each kind of stop has
one colour, used for its 4px ring and its small pill: green «PDF + صوت» (a study lesson: guide +
Rita's voice), blue «محادثة» (a conversation lesson), orange «تمارين» (an exercises stop: only its look
for now) and purple «ملفات» (a resources stop that opens a sheet of files and links). Stops are 88px,
196px apart, titles 14/700 and a 11.5px line. The road is a 6px grey line; the part already walked
(up to the current lesson) is blue, and the current lesson carries a small bobbing «إنت هون» tag.

Decoration only, never about the learner: three small lights travel slowly along the road, faint
line drawings (a book, a speech bubble, a globe, headphones, a pen, a sparkle) drift beside it, and a
field of 1px dots fades out behind the map. Under reduced motion the drawings stand still and the
lights are hidden. The bottom bar keeps «الدرس الحالي» and a 42px «متابعة» button.

Admins get «تعديل المسار»: hold a stop (300 ms) and drop it on another to swap them (it lifts and
follows the finger, the target grows, and the swap glides into place; the study circle's sounds play
on lift, hover and drop), or press a + in the gap between stops (or after the last) to add an
exercises or resources stop, which pops in. Every change is saved at once (`rita_set_path_layout`)
and undone if saving fails. Lessons keep their integer slots; stops sit between them with fractional
orders (`rita_path_items`). Motion is transform/opacity and stops under reduced motion.

**Levels (Nov 2026).** A lesson's level is its book's level (`rita_curricula.level`, A1–C2, set by
the admin under «أدوات متقدمة» → «مستوى الكتاب»). The road is cut into one section per level
(`src/lib/rita-path-levels.ts`): a white banner with a 1.5px ink border opens each section (a dark
44px level chip, «المستوى A2» and «2 من 8 دروس»); a finish stop closes it (a dark flag, a gold
trophy once every lesson of the level is done; tapping it says how far the learner is). The finish is
drawn after the level's last lesson unless the admin placed their own with + → «خط نهاية A1»; theirs
is moved like any stop. After the highest level a dashed grey «قريباً» banner names the next one.
«ابدأ من هون» on a later level's banner lets a learner skip ahead: earlier levels stay open to visit
and the current lesson moves to the first unfinished lesson of that level (kept on the device, per
language; «ابدأ من الأول» on the first banner undoes it). The header shows the language's flag, its
name and the learner's level; a tap opens the other languages. With no lessons yet the page shows
the language's flag and offers switching language or a free talk with Rita. While editing, only the
banners stay on the road, and a + at a level's edge sits above the next banner (it adds to the
level before).

## Floating window (study page, `FloatingWindow`)

A dark window over the study work area in the manner of iPadOS windows, opened from the circle (the
 trial item «معاينة الأسئلة» opens the local question preview below). Titled «Uzyra» with its
mark. Background #141416, continuous (squircle) corners drawn as an SVG clip path (Safari has no
`corner-shape` yet; `window-geometry.ts` holds the Figma corner-smoothing construction, radius 26,
smoothing 0.6), a hairline light edge and a deep soft shadow. A grey grabber pill above moves it (a
double tap on it or on the bar fills the work area and brings it back); a small dark X above the
top-right corner hides it, and three dots («•••») at the bottom middle of the work area then bring it
back or close it for good; any corner resizes it (curved mark bottom-right). Min 300×220, kept inside
the area, place and size remembered. It grows out of the circle and back into it with the circle's
sounds. No backdrop: the page, the selection and the circle keep working.

Type on the study page follows pro tools and the owner's UI research (Nov 2026): 13px for UI text and
12px for small words (top bar, state word, window), 13px for Rita's replies (the owner chose smaller
than the research's 16–18px; raise `.uz-rc-rita` if it reads small on the iPad); a thin 46px top bar;
the circle 56px and its options 50px (labels 12px, the quote 14px).

The guide is not a fixed page scaled to its pane any more (that made its text 8px on a phone). Until
the learner zooms by hand, its frame is as wide as the pane at scale 1 and the sheet reflows to that
width, at most 640px with grey around it (`SCREEN_CSS` in guide-html.ts; printing and the PDF keep
their pt sizes). Screen type: title 19px weight 650 (uppercase, as the guide), section titles 15px
600, text 14px at 1.6, table cells 13px (first column 600), head pills 10.5px 600, cards 13.5px with
14px titles, the Arabic note 14px; 1px #E4E4EA cell borders; sheet padding 28px (18×16 under 560px,
where wide matrix tables scroll inside their own section). A pinch or ctrl + wheel still zooms
around the fingers, and selection keeps working at any zoom.

## Temporary question design preview

The circle's «معاينة الأسئلة» item replaces the old Hello world demo. It opens the existing
draggable/resizable floating window with a dark Uzyra title bar and a white question workspace.
This is a client-only preview: three questions sampled once from six original English grammar
fixtures, no AI request, no save destination, no database writes and no changes to lesson progress.
The real generation actions remain unchanged. Closing for good discards the preview; hiding and
restoring it preserves the current question, selected/submitted answers and review flags.

Questionosis's standard session view is the visual reference: dark navy toolbar, question position,
previous/next arrows and a flag, an outlined question, 59px-minimum answer rows with A-D discs,
12px corners and a full-width dark Submit Answer button. The Uzyra mark replaces the reference's
identity; its questions, watermark and logos are not copied. Inter is self-hosted for this workspace
only (Fontsource variable Inter 5.3.0, Latin wght, SIL OFL license in `public/fonts/quiz`). Its
palette lives in `.qp` component tokens. Arabic uses the existing bundled Noto Sans Arabic.

One question is shown at a time. Native radio inputs allow one choice, then explicit submission
locks it and shows the correct answer, an icon/text outcome and a short explanation. Answered
count and accuracy are distinct; accuracy stays undefined until the first submission. Results
are derived from submitted answers only, never incremented on revisits. The three navigation
buttons expose current/answered/flagged states. On wide windows, progress/navigation sit beside
the question; below 850px container width, progress moves above it and navigation follows it.
At 480px the toolbar wraps into two rows. The save icon opens a portalled Radix popover explaining
that the destination is undecided and nothing is saved. No nested dialog or success toast.

Verification: `scripts/check-question-preview.mjs` renders the actual StudyPage, guide, orb, radial
menu, floating window and question component. Only voice, phrase dialog and server boundaries
are inert fixtures. It asserts no outgoing remote requests. Captures at 390/768/1180/1280px in
Arabic/English, navigation, submit locking, scoring and hide/restore are reproducible in Chromium
and WebKit. Physical iPad/Apple Pencil feel still requires hardware.

## Rita's written sheet (`RitaSheet`)

A long answer is said in one short sentence; the details are written under it as a small white
page in the study guide's style, never read aloud. The model writes them after the line `[[SHEET]]`
(`voice-agent/rita_sheet.py` keeps that part from the voice; `src/lib/rita-sheet.ts` reads it). The
page has an uppercase title over a hairline, a table whose heads are the guide's pills in turn (grey,
green, blue) with a bold first column on #fafafd, points with small blue squares, examples in italics
behind a soft blue rule with the key word bold (an English or German word opens the word window), and
a blue-soft «انتبه / Watch out» card. Each line reads in its own direction (any Arabic: right to
left). 12.5px body, 12px cells, 10px head pills, 13.5px title, radius 16, no shadow; it rises in once (reduced motion: no
movement). A sheet the model wrote badly still shows as plain lines. Short answers have no sheet.

### Explaining a part of Rita's answer

A part of one of Rita's answers (her words or her sheet) can be selected in the left column. That
selection is dark red (#8E1B2B, white text), never the guide's blue, and stays marked when the browser's
own selection goes. The circle takes a dark red ring, the quote strip a dark red edge with «من جواب
ريتا», and the ring offers one option only, «اشرحلي ببساطة» (dark red disc), plus the language. She
answers that part as to a complete beginner: one very simple sentence and a small sheet. A selection
across two answers, or with the learner's own words, shows «حدّد من رد واحد لريتا.» The newest
selection wins: selecting in the guide clears the left one, and the other way round.
