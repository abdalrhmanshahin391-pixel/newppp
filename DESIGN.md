# DESIGN.md — the visual system of Uzyra

## Home top (Uzyra Ultra)

The first thing on `/` (`UltraHero`). White page; behind it a field of small black marks on a loose
grid (24px, 20px on phones). A soft ring follows the pointer, or drifts slowly on its own; marks
under it grow into short dashes that point away from its centre and are pushed out, then settle
back to faint dots. Black only, never coloured. Plain WebGL, no library; it draws only while on
screen and holds still with reduced motion.

Order: «Meet», Uzyra's cube (30px, its usual idle life) and «Uzyra Ultra» on one line; the headline
«Learn a language by speaking it.», typed in letter by letter with a caret that blinks out; then
the cube again, large (168–264px). No buttons here: «Start learning» stays in the top bar and the
next sections. The headline is the page's only `h1`, in Google Sans Flex 450 with its own size
scale (107/72/56/40/44/36px at >1600/≤1600/≤1024/≤767/≤425/≤360). Keep it short and plain; do not
add a subline or a second claim.

## Home intro card (`IntroCard`)

Right under the home top: a black card, 16:9, 6px from each side of the page, corners 24px (36px
above 768px). The timing in `intro-film.ts` follows the reference landing page's intro video
section. We used its numbers and behaviour, not its code or video.

- **Scroll:** the card scales from 0.5 to 1 while its top moves from the bottom of the screen to
  the middle. On phones (≤768px) it scales from 0.92 to 1, ending 80% down. The curve is
  power2.out, and the card catches up with the scroll over 1s (power3.out, restarting from where
  it is).
- **Film:** drawn live on a canvas, in white and grey only.
  - 0–0.5s: dots fly in and draw the cube's resting outline.
  - 0.35–1.2s: the cube grows to 46% of the card's height, with a soft white glow behind it.
  - 1.2–1.7s: it shrinks into its place beside the name.
  - Around 1.6s: the live Uzyra (blue body, white eyes) takes over from the white dots.
  - «Uzyra», then «Ultra», wipe in from the left.
  - Behind everything, a slanted ring of dots turns slowly.
  - The film repeats every 12s. It starts when 40% of the card is in view and stops off screen.
- **Controls:**
  - Tapping the card, or pressing Enter, replays the film.
  - The round 48px button pauses and plays it.
  - With a mouse, the pointer becomes a white «Replay intro» pill. It appears with a 0.3s
    back-out, follows the pointer in 0.35s (power2.out) and hides in 0.2s. The round button
    hides while the pointer is on the card, until the pointer reaches it.
- **Reduced motion or Save-Data:** no scaling and no film. The card shows the cube and the name,
  still.
- **Not taken from the reference:** its product screens and its logo.
- **Check:** `scripts/check-intro-card.mjs`.

## Home feature section (`FeatureExplorer`)

Under the intro card. Its layout and motion follow the reference landing page's statement and
feature sections: we used their sizes and timings, not their code, words, icons or product screens.

- **Statement:** "Uzyra is a voice tutor and a study space in one…", 54px (34px on phones), typed
  in at 0.02s a letter with a caret once its top is 80% down the screen. Above it, a row of 98px
  circles (70px on phones) with seven lucide icons: mic, file, layers, games, star, headphones,
  graduation cap.
  - **Ripple:** each circle rises and falls `sin((x + phase) / screen width · 2π) · 35px`; the
    phase travels one screen width every 7s. It starts when the section's top is 55% down the
    screen and stops off screen or in a hidden tab.
  - **Drift:** the row slides 250px left while the section crosses the screen, tied to the scroll.
- **Rows:** five features: talk, keep every word, study, lessons, games. Each has a 42px title
  (28px on phones) that links to the page, a description and a square picture (corners 36px, 24px
  on phones). Desktop: copy in 4 of 12 columns, picture in 6, 120px between rows. Phones: centred,
  copy above the picture.
  - **Letters:** when a title's top is 85% down the screen, its description fades in letter by
    letter: 0.1s each, 0.005s apart.
- **Pictures:**
  - **Talk:** on black, the learner's line («كيف أحكي بدي ماي بالألماني؟»), the live cube speaking,
    then Uzyra's reply. The German in it is a button: it opens its meaning and how to say it (it
    opens by itself the first time).
  - **Keep every word:** the saved words fill in one by one, then fold into a fanned stack of
    flashcards. The button switches between the list and the cards.
  - **Study:** a real screenshot of the study page (`public/home/features/study.webp`, sample
    lesson, no learner data), cropped to the guide and shown in grey with `filter: grayscale(1)`.
    Delete that line to show it in its own colours.
  - **Lessons and games:** drawn from the product's own pieces: a lesson path with stars, and
    Wordcraft tiles with Pairs.
- **Colour:** black, white and neutral greys only; the browser check fails on any tint.
- **Reduced motion:** the text is there at once, the pictures show their last step, and the
  circles stay still.

### The rest of the home page, in the same style

The shared motion lives in `ag-motion.tsx` (typed headings, letter-by-letter text) and
`ag-hooks.ts` (start once in view, reduced motion). Arabic headings are not split into letters:
that would break their joined shapes.

- **Library preview (`AppWindow`, `LibraryShelves`):** a typed heading, the shelves in a soft
  grey frame with 36px corners that grows from 0.9 to full size with the scroll (no tilt), books
  rising one after another (70ms apart), and a black pill to open the library. Book covers keep
  their colours; everything around them is neutral.
- **Under the hood (`UnderTheHood`):** typed heading and letter-by-letter lead.
  - The demo sits in a 36px card with larger text; the language being heard is a black pill.
  - In the timeline, each bar draws itself with the scroll: it grows from its start as the card
    rises from 90% to 30% of the screen, one lane a little after the one above. Your speech is
    grey, Uzyra's steps light grey, and her speech black.
  - The six facts are 36px cards with letter-by-letter text. The measured number counts up from 0
    to 75 the first time it is seen.
- **Removed:** the old "Practise out loud" trio (`FeatureTrio`), and the lecture row in favour of
  "Keep every word". All blue on these sections is now black or grey. In Nov 2026 the owner also
  asked for the end of the home page to go: «Ask Uzyra anything» (`AskAnything`), the voice band
  (`VoiceBand`), the sticker shelf (`StickerShelf`), the questions (`HomeFaq`) and the closing
  invitation (`FinalCta`). The home now runs UltraHero, IntroCard, FeatureExplorer, the topic
  pills, the library window and Under the hood, then the footer. Do not bring them back unasked.
- **Check:** `scripts/check-feature-explorer.mjs` covers the feature section, the library preview,
  and Under the hood (Chromium and WebKit in CI).

## Home: Emith's card (`EmithShowcase`, end of home)

The last section before the footer, after Under the hood. A big black card (36px corners, 24 on
phones, 6px from the page edges) in the spirit of the closing card on antigravity.google: their
look studied, our own code.

- **Emith**, Uzyra's study partner in lessons and books, stands large on the right (on phones
  and tablets above the words). Her eight poses are cut from the owner's pixel-art sheet, with the
  white background removed and a 7px white sticker edge added (`public/media/home/emith`, WebP,
  about 20 KB each, loaded lazily): wave, idea, teach, think, laptop, listen, cheer, stand. She plays
  the next one every 2.8s while the card is on screen, landing with a small hop (0.44s squash and
  stretch); a tap plays the next one at once and throws the dashes outwards. A soft blue light sits
  behind her so her navy suit reads on the black; she floats 8px up and down.
- **The field:** blue dashes (`#3C82F6`, Uzyra's blue) turn slowly round her, slower further out,
  longer and brighter on a ring around her and near the mouse (which also pushes them aside). It
  is a 2D canvas, dashes batched by brightness, up to 900 (420 on narrow screens); behind the words
  most dashes are left out so the text stays easy to read.
- **Words:** "Your study partner", then "Meet Emith." typed in letter by letter with a blue caret
  that blinks at the end, a short line, and a dark "Start learning" pill to `/learn`.
- Runs only on screen in a visible tab. Reduced motion: one still frame, the first pose, no typing,
  no float. Checked by `scripts/check-feature-explorer.mjs` (dashes drawn and turning, typed title,
  pose changes on its own and on a tap, still under reduced motion).

## Who can open what

Signed out, a visitor can read about Uzyra but not use it. Open to everyone: the home page, the
games list, the library list, the learning hub, prices and offers, the blog, about, the legal pages,
support, and the sign-in pages. Everything else needs an account: the games themselves (Wordcraft,
Pairs, Repeat), every study tool, talking to Uzyra, lessons, books, and shared decks, question sets
and summaries (a shared link asks the visitor to sign in first).

- **Gate:** `RequireSignIn` sends a signed-out visitor to the site's own sign-in page (the welcome
  page, then sign-in or sign-up) and brings them back to the same address, search included, after
  signing in. There is no separate sign-in screen for these pages; the visitor sees a quiet
  placeholder for a moment, and the redirect replaces the page in history so Back does not loop.
  `RequireAuth` is the same gate under its old name, and a page that used to draw its own «Sign in
  to …» card renders `SignInRedirect` there instead. The site has one sign-in: the pages at
  `/start`, `/login`, `/register`, `/forgot-password` and `/reset-password`, never a second panel,
  card or window.
- **Their look (Nov 2026, `AuthFrame` in `src/components/auth/AuthPage.tsx`, `auth.css`):** the home
  page's language: the shared top bar (Home on the welcome page, Back on the forms), the home
  hero's field of black marks behind the whole page, Google Sans Flex. The welcome page is a
  centred hero: «[cube] Welcome to Uzyra», the headline in light 450 rising word by word, a black
  «Get started →» pill and a white «I already have an account» pill (stacked on phones), and the
  terms line. Every form (sign in, sign up, reset, new password) sits in one white card (28px
  corners, hairline, soft shadow) that starts with the cube: a muted hint, a 32px light title, soft
  grey fields that turn white with a black edge while typing, a black pill for the action, a white
  one for Google, links underlined in grey. Sign-up keeps its three short steps with a thin black
  progress line. Problems are a soft red note (username ideas as pills). No blue rings, no ink
  frames.
- **No profile step:** there is no «let's set up your profile» page after sign-up. A new account
  gets its name and username when it is made (the `handle_new_user` trigger); the rest is in
  Settings. Old links to `/welcome` go straight on to where they were heading.
- **No install prompt:** the account menu has no «Install app» item and no «Keep Uzyra one tap
  away» sheet.
- **Check:** `scripts/check-guest-routes.mjs` fails CI when a route is neither on its short public
  list nor guarded.

## The home cube

No background lines: the Hedwig-style animated contours were removed (Nov 2026) at the owner's
request; they were too visible and redrew a full-screen layer 12 times a second on every page.

The home top (`UltraHero`, above) is the only hero: the earlier tap-a-word hero (headline with
sticker pills, orbit rings, word chips, the two big buttons) was removed in Nov 2026 because the
new top replaced it; do not bring its rings or chips back. Uzyra is a flat soft blue cube (#3C82F6) with
white eyes, no shadow or texture; it and its level driver stop offscreen or in hidden tabs, and
reduced motion makes it static. Use `scripts/check-home-cube.mjs` for isolated Chromium/WebKit
component checks, screenshots and phone/tablet videos; it uses local account/reader fixtures, not
production voice or database.

### How Uzyra moves (`RitaCube`, engine in `src/components/rita-study/mascot`)

The look and the rhythm follow the bots on x.ai/bot, as the owner asked: the soft square shape of
their red bot, in the blue of their blue bot (`#3C82F6`, the owner asked for exactly that blue; it
was `#EA4045` red until Nov 24 2026), their proportions (a squircle with some thickness and round edges),
and their timings, ranges and easing curves, read from their page. The shapes, clips and code are
ours; none of their drawings or animation files are used.

- **Shape.** A soft cube: 76 × 76 from the front, 28 deep, every edge rounded (8). From the front
  it is a squircle like the red bot on x.ai/bot (measured on their page: a superellipse of
  exponent about 2.9), so each corner bends into the side with no visible seam and the sides
  bulge a little; the formula is ours, not their drawing. It is a squircle slab widened by a ball,
  so the farthest point in any direction has a closed form; the outline at any turn is those
  points for a ring of directions (48–168 by size). They move smoothly as it turns, so it never
  shakes, and its round side shows as it turns away (edge on it is 28 wide).
- **Eyes.** Flat shapes on the front face, turned with it, so they slide and narrow as it turns
  and hide just before it is edge on. At rest two upright pills (9.5 × 20.5, 20 apart, a little
  below the middle). Always pills or arcs, never small round dots. Feelings: neutral, attentive,
  squint (thinking: shorter pills), happy (the eyes flip into ◠ arcs), surprised, curious (one
  eye shorter), sleepy (◡ arcs). A feeling always changes inside
  a blink, when the lids are shut. A blink lasts 0.24 s and opens with a small overshoot.
- **Clips per mood**, keyframed, played 25% faster than written (`SPEED` 1.25):
  - waiting: float, glance, hop, spin, front flip, double hop, peek (turns to show its side and
    peeks back), look up (the eyes roll up, then flip into happy arcs); rarely a doze;
  - listening: lean in, nod; thinking: ponder, tap-tap, a tumble; speaking: talk, explain, a happy
    spin.
  The favourites come up often: a spin or a flip in about a quarter of the waiting clips, and the
  happy eyes after every hop and spin. A whole turn takes about 0.85 s on a curve that is fast in
  the middle and soft at both ends (`cubic-bezier(0.6, 0, 0.3, 1)`), so it peaks near 21° a frame
  at 60 fps and never strobes; most other moves are in-out `(0.42, 0, 0.58, 1)`, quick turns
  `(0.74, 0.03, 0.26, 1.02)`, a wind-up `(0.4, -0.14, 0.16, 1)`.
- **Squash and stretch.** Jumps crouch, stretch on take-off and squash on landing, within their
  ranges (0.93–1.12 across, 0.88–1.09 up). On top, the engine adds follow-through: it stretches
  along fast moves up or down and while it spins, leans into a spin and wobbles back when it
  stops (a spring), and jiggles like jelly when it lands. Everything is kept within 0.86–1.16.
- **No jumps.** A new clip (or a new mood) starts from wherever it is and blends in over 0.4 s;
  whole turns are folded away first so it never unwinds. A test runs 60 s of moods and voices at
  60 fps and checks no frame moves more than 5 units or turns more than 24°.
- **Voices.** Listening: the learner's voice presses it down and tips it forward. Speaking: it
  rises and stretches with Uzyra's voice.
- **No pointer, no taps.** By the owner's choice it does not follow the mouse or react to taps;
  it only plays its own clips.
- **Cost.** Three SVG paths written only when they change; nothing offscreen or in hidden tabs;
  reduced motion holds the body still (blinks only).

## Top bar menus (`src/components/header`)

All the bar's menus (Resources, credits, language, account) share one panel under the bar, built
from our own code (the behaviour was studied from a public site; none of its code is used). The
bar and its menus are ink, white and grey only: no orange, blue or red anywhere (the page you are
on is underlined, not coloured; «Log out» and the used-up credits are ink too). A script checks
every element's computed colours (`scripts/check-header-menus.mjs`), so a coloured rule fails CI.

- **Panel:** white, 12px corners, a 1px ring and a soft deep shadow (`0 16px 48px -8px` at 22%).
  It opens with a fade and a scale from 0.96 over 200ms (`cubic-bezier(0.16, 1, 0.3, 1)`) from the
  edge that hangs from the trigger (right for the account tools, left for the navigation; flipped in
  right-to-left pages) and closes the same way. It stays inside the screen with an 8px margin.
- **Switching menus** (point at another trigger while one is open, or ←/→): the panel moves along
  the bar and changes size in 400ms with a light spring; the old content slides 80px away and
  clears in 140ms, the new content slides in and fades in a beat later (350ms).
- **Highlight:** a 5% black rounded box glides between items (150ms) and stays 80ms after the
  pointer leaves one, so crossing a gap does not flash it. Mouse only; keyboard focus shows it too,
  with a 2px ink outline.
- **Opening:** a click opens; Resources also opens when a mouse rests on it and closes when it
  leaves, unless it was clicked (then it stays until a second click, Esc or a press outside). On a
  touch screen it is taps only. ↓/↑ on a trigger open the menu and move through the items
  (Home/End too, wrapping), ←/→ switch menu in screen order, Esc closes and returns focus to the
  trigger, and tabbing away or pressing outside closes it.
- **Reduced motion:** a 120ms fade only, no scale, travel or glide.
- A menu is added by putting its trigger and `MenuPanel` inside a `MenuGroup`; the menu keeps its
  own state and content (the panel draws it through a portal). Items are `[data-mp-item]` or
  `.rh-item`. Outside a group (the phone sheet, a page without one) a menu is a plain card.

## Conversation history

The conversation page prioritizes resuming a saved conversation. Use a compact title and new-chat
action, title search, ordering and a remembered list/cards toggle. Rows use a quiet message icon,
title, last-activity date, message count and an always-visible action menu suitable for touch.
Pinned conversations precede recent history. Rename and pin are owner-controlled account data.
Deletion requires a named confirmation with saved-message consequences. Exports live in a submenu.
Admin review tools sit in a closed disclosure, with no instructional panel on this page.
Use the existing white, ink and blue tokens, bilingual labels, logical spacing and 44px targets.

## Settings workspace

`/settings?section=account|security|plan|usage|billing` combines profile and plan management.
The account menu has one Settings entry. `/profile` and `/my-plan` redirect to the corresponding
section; pricing, offers, checkout and allowance links open the relevant section directly.

Use the existing white, ink and blue app palette and type. A 232px rail stays physically left
in Arabic and English, separated from the content by a hairline. Labels, descriptions, fields
and quiet controls form rows, not a grid of decorative cards. Account/security are grouped
above plan/usage/billing. Local settings search matches Arabic and English terms. Below 900px
the rail becomes a labelled section picker; forms stack below 560px. Controls are at least
44px high, inputs 16px, with visible keyboard focus and reduced-motion support.

Profile drafts survive section changes, with a warning before leaving Settings. Security fields
unmount on section changes. Existing auth, avatar storage, plan allowances and Paddle services
are reused. Data loads on demand by section, with explicit loading, empty, error and retry states.
Unknown allowances are never shown as unlimited; extra packs are included in totals. Saved
cards are distinguished from the payment method attached to a subscription. Invoices open
Paddle's portal using a fresh session. Confirmation explains that removing a card also stops
renewal. Provider confirmation precedes local updates; partial failures stay visible.

## Study circle: five help services and two practice tools

The guide and assistant answers share the same whole-word selection gestures, word boxes,
connecting strokes and selection sounds. The guide is blue; assistant answers use a translucent
burgundy tint with the text colour preserved. An answer selection stays within one answer,
excludes surrounding controls, follows scrolling/resizing and clears when a guide selection wins.
Finger swipes still scroll before the hold threshold; a second touch cancels selection for zoom.

**Uzyra's recorded lines.** Every circle action (lessons and books) has two short spoken lines in
Jordanian Arabic («البطاقات جاهزة.», «هاي الفكرة ببساطة.», …), recorded once with Uzyra's call voice
(Cartesia, Layan, sonic-3.6; `voice-agent/uzyra_voice_lines.py`, made again by the content-probe
workflow's «voice-lines» task) and served from `public/sounds/uzyra/` (24 files, ~540 KB). They never
read the answer and avoid masculine or feminine "you" forms. `voice-lines.ts` picks the line when
the action is chosen and decodes it while the answer is written (all lines are decoded the first
time the circle opens); it plays in the same moment the answer, the cards, the questions or the
meaning card shows, starting from the voice (the files' ~0.13 s of silence is skipped), and a line
not ready within 250 ms is dropped rather than played late. The two lines take turns; the circle's
sound switch silences them; nothing plays on a failure or during a call (Uzyra speaks then).
Reduced motion disables selection animations. The call-start hold uses a quiet sine pad with a
small pitch lift and a soft two-note completion; release, cancellation, blur and mute fade the
hold sound out immediately while its visual fill may drain. Existing hold timing is unchanged.

**The study wheel** (`RadialMenu.tsx`, `wheel-layout.ts`) is the same in the lessons and the books:
one whole wheel of eight touching slices that grows out of the circle, each slice always in the same
place and colour so the hand learns it. Clockwise from the top: «اشرحلي» (blue 110 168 255), «معنى
ونطق» (teal 62 224 200), «فلاش كاردز» (amber 255 201 92), «تمارين» (violet 183 155 255), «بالعربي»
(green 126 224 143), «ليش هيك؟» (pink 255 143 200), «فكّك الجملة» (sky 95 214 255), «انتبه للغلطة»
(coral 255 138 122). The slices are dark navy glass (#0a1330 → #13224f from the centre out) with
hairline #9cc1ff seams; each has its icon in its colour and a thin rim light of that colour. The slice
under the finger glows in its colour from the rim inwards, its rim thickens and glows, a short
pointer arc on the inner ring turns to it, and a pill above the wheel names it (or, for a dimmed
slice, says what to select). A slice that does not suit the selection stays in its place, dimmed:
the number and the places never change. Around the wheel, a hairline dial with fine ticks (a long
one at each slice's middle) turns into place as it opens; a dashed ring turns slowly round the
circle. Near an edge or a corner the circle slides inwards (340ms) until the whole wheel fits, and
slides back on closing; on a phone the wheel shrinks (104–142px radius) but stays whole. Hold the
circle and move towards a slice and let go: only the direction counts (a short move up is
«اشرحلي»); tapping a slice, and arrows/Enter/Esc work too, and every slice plays its note. The
language choice and «في غلط بالدرس؟» are tools in the selection strip; the language choices open as
four slices in the same wheel. In Uzyra's answers (dark red) the explain slice becomes «اشرحلي
ببساطة» and the others dim. Reduced motion keeps only fades.

**On a book page the wheel has three slices** (same look, places from the top): «ترجملي»
(blue, Languages icon), «معنى ونطق», «فلاش كاردز». The other five stay in the lessons only.
«ترجملي» is a faithful, professional translation of the selection into standard Arabic (English
for an Arabic book): every sentence in order, nothing added, no explanation; it takes up to 3000
characters (a paragraph or two), where the other slices stop at 600. On a selection in Uzyra's
answers the top slice is «اشرحلي» again (dark red). The book's flashcards open in the same floating
window as the lessons (grows from the circle, moves, slides off the right edge with a tab, X hides
it and ••• brings it back), with its own saved place (`uzyra-window-rect:book-practice`).

Practice reuses the selection-based generators and their authentication, quotas and validation.
Results open in a single white workspace (maximum 672px), a bottom sheet on phones, with the
existing typography and blue action colour. Cards reveal their answer and optional note and
have previous/next controls. Each question has four options; choosing one locks the answer and
shows the correct choice and reason in text, never colour alone. Navigation retains answers.
Loading, server errors, empty results and retry remain visible. Retry uses the original selection,
and duplicate generation is blocked. A failure says its real reason and offers only what can help:
a service that is not set up on the site («التدريب مش مفعّل على الموقع لسا…») gets a quiet «إغلاق»
and no retry, and uses none of the learner's allowance; flashcards that cannot be made from a rule
or explanation without examples say so and offer «اعمل أسئلة اختيار» on the same selection; a busy
or one-off failure keeps its own words and «جرّب مرة ثانية». Closing does not reopen automatically when generation ends;
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
All the services share the existing loading, stop, retry and request-replacement behaviour.

This is the source of truth for every visual change. It was written from the code that is
already shipped (`src/styles.css`, section "Home page theme", and the Uzyra components), not
invented. When a design request conflicts with this file, say so first, then follow the owner's
decision and update this file.

Process for any design request: `docs/design-workflow.md`. Product context: `PRODUCT.md`.

## Identity

Clean white page, ink text, one blue action colour, dark top bar. Friendly and clear, never
generic SaaS. Uzyra herself carries the personality (the orb and the Little Light Wanderer);
the page stays calm around her. Arabic and English are both first-class (RTL per paragraph).

## Where it applies

Scope class `.edith-premium` (home, `/rita`, `/rita-live`, lesson screens, admin curricula).
Pricing, study and admin keep their own palettes unless the owner asks otherwise. New screens
on the Uzyra side must sit inside `.edith-premium` and use its tokens, never raw hex values.

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
- Direction follows the content: `dir="auto"` on user/Uzyra text, per paragraph.

## Shape and spacing

- Radius: buttons and inputs 8px, cards 16px, sheets 24px (top corners on phones).
- Buttons: 2px ink border, blue fill, white text, `.rita-btn` / `.rita-btn-primary` /
  `.rita-btn-secondary`, small `.rita-btn-sm` (40px). Selects: `.rita-select` (48px). On the
  home page and the app pages the calm scale applies (see "App pages": 42px / 1.5px / 15px).
- Small choice of two to four options (the live page's "Uzyra explains in"): `.rita-choice`, radio
  buttons in one row, 44px high, 8px radius, hairline border; the chosen one has a 2px
  `--pp-accent` border, `--pp-accent-soft` fill and `--pp-accent-text`. Arrow keys move the
  choice. Use it instead of a select when every option should stay visible.
  `.rita-choice-stack` stacks the same group in one column for longer labels (the "Report a
  problem" reasons under a Uzyra reply, which expand inline, never as a window).
- Admin quality screens (`/admin/rita-quality`): a row of four number cards (`--pp-grey`, 16px
  radius, value 34px/600, a muted note, and a change line that says "Better by"/"Worse by" in
  words, never colour alone), a list of problem cards (hairline border, title first, one meta
  line), and Uzyra's reply beside the reference reply (grey card next to `--pp-accent-soft` card,
  stacked on phones). Small samples are said out loud, not hidden.
- Admin tool screens (Uzyra quality and the admin strip): one blue primary action per view; everything
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

The site and its assistant are **Uzyra** in English and **يوزرا** in Arabic, including lessons,
free conversation, written answers, exports and admin screens. The assistant introduces herself as
"أنا يوزرا" / "I'm Uzyra" when asked. Historical conversation labels never override this identity.
Legacy technical identifiers, URLs (including ritajet.com), tables, events and asset paths keep their
names for compatibility; they are not public assistant names. The logo is the owner's symbol (five
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
  in ink (no Uzyra face); a 1pt hairline under it.
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

Every page except home takes `data-tone="light"` (dark seasonal themes fall back to the ink
look), as first done for the blog: the blog's
white surface with a thin `#e6e5e4` rule, ink `#181719` text, muted `#646365`, the grotesk
font, 14px links, a lighter 500-weight heading, the black pill «Start learning» like the blog
header, and a pale `#efeeed` wordmark. Layout, links and the blue thread are unchanged.

The study header keeps Back to lessons and optional PDF download. The lesson
title and admin-preview notice remain available to screen readers. Visible sample
headings, sample-switch and challenge shortcuts are removed. Idle copy below Uzyra's
cube is omitted; connecting, failed and active statuses remain visible.

## Top bar and menus

**Language and account (Nov 2026).** The learning language shows as its flag (22px, 5px corners,
a hairline ring), the code («EN», 13/600) and a small chevron, in a 40px white pill with a #e4e4e8
hairline (grey on hover or open; the chevron turns). Its menu lists each language with its flag
(28px), its own name and, under it, its Arabic name; the current one is light grey with an ink ✓.
The account photo is round (36px in the bar, 34px in the phone's menu button, 44px in the menu)
with a 2px white ring and a faint outer line, cropped from 20% of its height so a face shows, and
it fades in once loaded; a photo that fails shows the initial. A chevron sits beside it, and a
short 22px line separates it from the tools before it.


## Uzyra's board (`StudyWhiteboard`, «اشرحلي» on the lesson page)

Since Nov 2026 the board is one full-screen sheet on a soft light-blue sky (a radial gradient, lighter
in the middle), drawn by hand (`board-sketch.ts`): straight strokes bow a little, gentle point lists
(waves, arcs) are drawn as smooth curves, ellipses overshoot where they close, and a circled word sits
in a hand-drawn rounded box. Ink is dark slate `#3a404d`, what matters is blue `#2747c9`; Arabic words
are weight 400. Each section's title is a quiet centred line above its drawing; past sections are
dimmed (60%). The selected text is one quiet italic line at the top («من الفقرة …»).
The pen starts at once and keeps its own quick pace (about a quarter of a second a stroke, 1.2–3.5 s
for a section); the voice plays alongside and never holds the pen back. Pausing stops both.
- Top left: Uzyra's cube in a white ring with a soft blue glow (thinking while the board is being made,
  speaking while the voice plays), then round dark 46px buttons: play/pause, «نص الشرح» (the words
  as a white subtitle above the question bar; on by itself when there is no voice), and «نزّل السبورة
  كصورة» (the open section as a PNG on the same sky, with its title; the SVG if the browser refuses).
  The voice note («جارٍ تحضير الصوت…») sits after them in a soft pill. Top right: a round dark ✕.
- Bottom: a 60px round dark microphone (hands-free «تمام») and a dark pill «اطرح سؤالًا متابعًا…» with a
  white round send button; focusing it pauses the voice. «تمام، كمّلي ←» is a white pill just above,
  with the previous section beside it; status and errors are dark pills there too. No camera button:
  the board takes no photos.

## Checkout (`/checkout`): two halves, look only

Since Nov 2026 the checkout is drawn in two halves like a hosted card checkout, in the home page's
language (`src/components/checkout/`). Left, near-black (#141414): the home hero's field of marks in
white (`useDotField(..., "#ffffff")`), «← [cube] Uzyra», «Subscribe to <plan>», the price at 52px
weight 450, a pill switcher between the paid plans (white pill for the chosen one), the plan line with
two figures (call minutes a day, Groq requests a month), Subtotal, «Add promotion code», Tax and
Total due today. Right, white: Apple Pay and PayPal buttons, OR, Contact information (the account's
email), Payment method (Card / Apple Pay / PayPal with joined fields and black radios), Phone number
with the country's flag, and a black «Pay and subscribe» pill. Google Sans Flex throughout. On phones
the summary sits on top and folds behind «Details».
It is look only: nothing is charged or sent; the buttons and codes say payments open soon. When
Paddle is linked, the card fields move into Paddle's frame (Paddle does not take card numbers from
our own fields). The Paddle-linked page is in git history at 770d665.

## Learn (`/learn`) and Games (`/games`): the home page's frame

Since Nov 2026 both pages open with `PageHero` (`src/components/page-hero/`): the home hero's field
of black marks (`useDotField`, the same field as the home, on a 2D canvas, fading out downwards),
«[cube] page name» at 17px, a Google Sans Flex headline at weight 450 (64px, 40px on phones) whose
words come in one after another with a caret, and a 19px muted lead. /learn: «Talk, learn and
practise.»; /games: «Play with words.». The section rail and the section titles use the same face
(rail 15px/500 with the black pill for the open section; titles 30px/450). The game cards keep their
own colours, drawings and buttons. Reduced motion: the field is drawn once and the words show at once.

## Classrooms and study groups (`/spaces`, `/spaces/:id`, `/join/:code`)

Since Nov 2026 these pages speak the home page's language (`src/components/spaces/`, styles in
`spaces.css`, all under `.sp`): Google Sans Flex at 450–500, ink and white with neutral greys,
round pills, 20–32px corners. A space's own colour (apricot, sky, lilac, mint, coral, lime) appears
only in its **mark**, a rounded square with its emoji and a faint dot texture (like an app icon),
and as a soft light behind its header. No coloured banners.

- **`/spaces`:** `PageHero` (the home field of marks, «[cube] Classrooms & groups», «Study
  together, in one room.») with the **join bar** under it: one wide pill that takes a bare code or
  a whole invite link, a Paste button and a black «Join» pill, and says plainly what is wrong.
  Then two **start cards** side by side: an ink one for a classroom (a room of seats with a board;
  hovering fills the seats, one seat is Uzyra's blue) and a grey one for a study group (three
  people and a dashed «+» that make room on hover); the whole card is the button. «Your spaces»
  has a filter pill (All / Classrooms / Study groups, with counts), a search above six spaces, and
  white cards: mark, kind and role chips, the name (two lines at most), the line about it, then
  members and decks with an arrow. Loading shows grey bones; nothing yet shows Uzyra's cube with
  both ways to start. «How it works» is three numbered steps on a hairline, not cards.
- **Making one:** a window (a sheet on phones): the kind as a two-way switch, a live preview of
  the card, then name (counter), a line about it (optional), sixteen emojis and six colours. The
  name field gets the focus.
- **A space (`/spaces/:id`):** an ink header card with the field of marks in white and the light
  in its colour: «← All spaces», the mark (84px), kind and your role, the name (up to 60px, 450),
  the line about it, then the first faces with «+N», the member count, and three numbers (decks,
  question sets, announcements). Actions on the right: white «Invite» (copies the link, or opens
  the phone's share sheet), «Add deck», and «⋯» (copy link, settings, leave; on phones «Add deck»
  moves into it). Under it the sections as pills that stay under the top bar (black for the open
  one, counts in mono): Overview, Decks, Question sets, Members, Announcements, Chat (when on) and
  Settings (owners). `?tab=` opens a section directly; opening one while scrolled brings it up.
- **Overview:** the pinned announcement, the latest four decks, recent activity (decks added,
  posts, people joining, when it was made; built from what the page already loads), and beside
  them the invite panel for owners (the code large in mono, Copy link, Share, «Make a new link»
  with a warning), the people with their roles, and «About» (kind, started, chat, who adds decks,
  who posts).
- **Decks:** folders as a title on a hairline (rename and delete for owners, «Add here»), decks as
  white tiles (cover mark, title, cards and who added it, rating, black «Study»; «⋯» to move it to
  a folder or take it out). An empty folder is a dashed «Add the first deck» target. New folders
  are made in a row on the page, not in a browser prompt.
- **Members:** grouped (Owner, Co-owners, Members), a search above eight people, one row each
  (picture, @name, name, when they joined, role chip, «⋯» for owners: co-owner / member / remove).
- **Announcements:** a writing box with your picture (Ctrl/⌘ + Enter posts), then posts on
  hairlines, pinned first on a light grey band; owners pin and delete.
- **Chat:** a messenger: yours on the right in ink, others grey on the left with picture and name,
  grouped by day and by person (five minutes), times under each group; it follows new messages at
  the bottom and offers «N new messages» when you scrolled up. Enter sends, Shift + Enter breaks.
- **Settings:** name and look (the same fields as making one, Save and Undo), the invite panel,
  how it works (a switch for chat, two-way choices for who adds decks and who posts), and delete
  (owner) or leave (co-owner). Members leave from «⋯» in the header.
- **`/join/:code`:** one ink card centred: the mark, «You're invited to a classroom», the name, the
  line about it, the member count and a white «Join classroom» pill; a broken link says so and
  points back. Signed out, every one of these pages goes to the site's sign-in and comes back.
- **Rules:** every destructive action asks first in the page's own window (never the browser's);
  every failure is said in a toast and keeps what was typed; red only for removing and deleting;
  windows are one level; reduced motion stills the hovers, the bones and the field.

## Pricing (`/pricing`): four monthly plans

Since Nov 2026 the page sells four monthly plans beside the free one: Uzyra $23, Plus $30, Pro $40
and Max $50 (`plans.billing_months = 1`). Plans differ only in two allowances: minutes of calls a
day (`free_talk_seconds`, `free_talk_period = 'daily'`) and Groq AI requests a month
(`max_groq_requests`); every plan has every service. The page keeps its dark style (grotesk,
`--pro-card` cards, 24px corners, white pill):
- A one-line lead under «Plans and pricing»; the billing switch only when there is a choice.
- Five cards, one row on wide screens (2 or 3 columns below that, one on phones). Each card: name,
  price, tagline, then two figure tiles (white 6% fill, 16px corners, 22px figure and a 13px
  label): «30 min / of calls every day» and «1,000 / Emith requests a month», then the four
  services with checks and the pill. The popular plan has a thin white ring.
- «Compare plans»: Calls with Uzyra (every day, in a month at most, the three call kinds) and Emith
  requests (a month, what they cover), scrolling sideways on phones.
- «How we count»: two cards, call minutes and Groq requests, each with three examples.
- «What you can do with Uzyra»: four tiles (free conversation, path lessons by voice, book study,
  path exercises), then the questions.
The older 3-month plans are hidden, not deleted.

Public pages never name the AI providers behind Uzyra (Groq, Soniox, Gemini and the like): the
request allowance is called **Emith requests** («Emith requests a month», «What is an Emith
request?»), after Uzyra's study partner. The provider names stay in code and the admin only.

**Books Reader** (`books_reader`, $17 a month, 10,000 Groq requests, no calls) is not a fifth card
in that row: it sits under the row in a wide card of its own (`BooksReaderCard`,
`books-reader-card.css`). It keeps the page's language (24px corners, 16px figure tiles, the pill,
the grotesk) but inverts it, so readers see at once that it is a different thing: an ink card
(`--pro-ink`) with the home page's faint dot field fading in from the end side and a soft blue
light, a «For readers» pill, the name, two tiles at white 8% («10,000 / Emith requests a month»,
«Reading / no voice calls in this plan»), four reading services in two columns. The side holds a
small shelf of nine books in white and greys with one in the brand blue (it lifts on hover; the
last book leans), the price and a white pill. Under 860px everything stacks. It has its own column
in «Compare plans» (dashes for the call rows). At checkout it shows its price and requests, and
«Books» in place of call minutes; the plan switcher there lists only the plans with calls.

The blog, home and inner pages share the blog header's white surface, 60px height, 16px wordmark
and 14px grotesk type. Library, Pricing and Resources share the same spacing and text weight
across pages, and Start learning uses the black pill. The header remains visible while scrolling
with the same width and shape. The main site also includes Games and the existing sign-in,
credits, language and account controls. On narrow screens the main site puts its extra links and
actions in the menu, keeping the header text at 14px.

Resources, account and mobile menus use white cards, light borders and 14px text. The main site
keeps one disclosure open at a time. Escape and a press outside close the desktop disclosures
through the existing header dismissal behavior.

## Learning home (`/learn`)

One section at a time, three sections: Talk to Uzyra (free talk and Lessons), My study space
(Flashcards, Lecture Lab, To-do and Exams: four equal cards, two to a row from 640px, one below)
and Together (Shared decks and Spaces, the same two-to-a-row grid). Memory Lab, PDF summary, All
in one, Question bank and the German section are retired from the hub, the header menu and the
footer (`RETIRED_TOOLS` in `site-tools.ts`); their pages and saved work stay at their own
addresses. An old `#plan` or `#german` link opens the first section. From 1024px, a sticky section rail
sits beside the content; below it, a horizontal strip with 44px targets. Arabic mirrors the
layout. Real due-card and lesson counts remain optional account data, never invented.

- **Monochrome:** flat black cards (`--uz-tile-bg: #000`, matching the existing monochrome WebP
  artwork), soft-white foreground (`--uz-paper: #f2f2f5`) and readable neutral secondary copy
  (`--uz-on-tile-muted: #b9b9c2`). The selected rail entry uses the existing ink token and white
  text. This exception is local to `/learn`; other screens retain their existing action colour.
  No gradients, image blending, animated shadows or continuous decorative motion.
- **The two Uzyra cards (game-card look, first pair of the card redesign):** "Free talk with Uzyra"
  and Lessons are solid blue cards (`#2b73c7`, one colour, no gradient; white text 4.9:1), 32px
  corners, a big centred title (30–40px, 700), one line, a flat drawing at the bottom and a white
  button with 16px corners and a 6px `#d5d9e3` lip over the bottom of the drawing. The drawings
  (`PlayCardArt.tsx`) use the Uzyra mark as the hero: in a white speech bubble with two "typing"
  bubbles (yellow, green), and on a yellow book cover with a pink ribbon. No characters, no
  microphone, no stars. Second round, same blue and button: Flashcards (a fanned stack, the mark on
  the white front card), Memory Lab (a 2 × 2 memory board, two tiles turned to show the mark) and
  Pairs (a white and a yellow card with the mark leaning together under a green tick). Drawings keep
  their important parts above the button. Third round: Wordcraft (a letter board, a found word in
  green, the mark on the middle tile), PDF summary (a page with the mark, highlighted lines and a red
  PDF label), All in one (a yellow box with the mark, a card, a page and a question coming out) and
  Question bank (the mark in a question bubble, three answers, one green with a tick), and Lecture
  Lab (a slide on an easel with the mark and a yellow question note). Last round: To-do (a
  clipboard with the mark, two tasks ticked), Exams (a calendar page with the mark on its red band, a
  day circled, an A+), Shared decks (three cards and a share arrow), Classrooms (a yellow folder with
  the mark and a members badge) and German Lab (a "Hallo!" card with the mark, the flag's colours
  and a "Danke" bubble). Every /learn card is now a game card; the monochrome tiles and their
  pictures are gone. Text drawn in the pictures stays left to right in Arabic.
- **Hierarchy:** the conversation stage and Lessons sit together; the other sections are even
  grids of equal cards (no wide leading card), so no section ends with a lone card. Every destination, description and AI
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
  (title in `rh-app-title`, grey panel, no dead end). Guests see the pages as before. The German section,
  its side-list item on `/learn` and the footer link were retired (the German Lab page itself stays).
- **Admin** (`/admin/languages`, Arabic, RTL): one card per language with its flag, "visible to learners",
  "Uzyra voice" and a country menu for the flag (names from `Intl.DisplayNames`), up/down order, counts,
  and an add form with a live flag preview. A language that has content is
  disabled, not deleted.

### Language map (what follows the learning language)

Kept per language, so switching shows the other language's own copy (nothing is deleted):

| Feature | How it is kept apart |
| --- | --- |
| Flashcards, their subjects board, the due counter | `rita_@<code>_` keys (`langKey`, `scopedKey`); review counts only the active set |
| Pairs, practice questions, Memory Lab | the same per-language keys (`rita_@<code>_mem_`, `_q_`) |
| Conversation word tray (`useLearningTray`) | one stored list, shown and saved per language (`entriesIn`); another language's words wait for it |
| Words saved by Uzyra to subjects | the server offers only the active language's subjects and stamps the language on the row |
| Lessons, free conversation, shared decks | the language column on the rows (lesson books must name their language) |
| Games (Wordcraft, Repeat) | English or German word lists and sentences, chosen by the learning language |
| Library shelves and «آخر كتب قرأتها» | books in the learning language first; "every language" shows all. Own PDFs always show |
| Home page examples | English or German words for the learner's language (mixed for guests) |

Shared by every language, on purpose: the to-do list, exams, study spaces, Lecture Lab (they belong
to the learner's studies, not to a language), the streak and study days (one learner, one habit), and
the explanation language (Arabic or English, the site's own language).

The flashcards page says whose cards are on screen in one quiet line under the board's top
(`LanguageScopeNote`: flag, "Your German cards · each language keeps its own"). Cards made before
languages existed live under the learner's first language. `language-switch.browser.test.ts` saves
English and German content side by side, switches back and forth in Chromium and checks each
language sees only its own cards, subjects and tray words, and that a save sends no other language's
word.

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
- **`/study` itself (Nov 2026, the home page's look, `flashcards-page.css`):** «[cube] Flashcards», a light
  headline «Your flashcards.» (Google Sans Flex 450) and a muted lead; one toolbar under it: a «Study | Edit»
  switch (black pill for the open one) and the actions as hairline pills (Remove in red); then the list and one
  session card (white, 24px corners, soft shadow): «N cards ready», From and Flagged, an «All cards | Flagged»
  switch, and one black «Study · N cards» button (56px), with the ticked sub-subjects as pills under it. On the
  owner's request there is no Smart review, no Shuffle, no «Due now» and no daily panel (cards due, daily goal,
  next 30 days, schedule, progress) on this page. The search is a soft grey pill and «New» a black one. With
  no subjects, a dashed card with the cube and «Make your first subject». Under 1024px the session card sits
  above the list; on phones the actions scroll sideways in one row.
- **Session panel elsewhere** (`LaunchPanel`): one solid blue button on top ("Smart review · N" when cards are due,
  "Study mode" when nothing is due), with a one-line hint under it, then two compact outline buttons side by side.
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

## Lecture Lab (`/study/lectures`, `/new`, `/run`)

Since Nov 2026 in the flashcards page's look: the same `fc-` classes (`flashcards-page.css`) plus
`lecture-lab.css` (`ll-`) for what only Lecture Lab has.

- **`/study/lectures`:** «[cube] Lecture Lab», the light headline «One lecture in. A quiz out.»
  and a muted line; a toolbar with one black «New lecture quiz» pill and the counts («3 subjects ·
  12 lectures») on the other side; the unframed subject list; and one session card: «N questions
  ready» counts only the chosen pool, rows for Lectures, Weak spots and Flagged (of the ticked
  lectures), «Which questions» (All | Weak spots | Flagged) and «How» (Study | Session | Timed) as
  two three-way switches with a one-line note on the mode, «Exam time» as − / minutes / + (only for
  Timed), one black start button that names what starts («Study · 15 questions», «Start exam · 20
  min»), and the ticked sub-subjects as one-line pills. An empty pool says so instead of starting.
  With no subjects there is no session card: a dashed card with the cube, the three first steps on
  hairlines and «Make your first subject».
- **`/new`:** the same head («← [cube] Lecture Lab» goes back), «New lecture quiz.», then three
  numbered steps on hairlines (no framed boxes): where it goes (the list), the lecture (PDF | Paste
  text switch, a dashed 24px drop zone that turns solid with the file's name, a soft grey title
  field), and the shape (question counts and difficulty as pills, black when chosen, the key-points
  tick). One black «Make the quiz» button.
- **`/run`:** the question player is unchanged; the end shows «[cube] Exam complete», the score
  large and light, «Retry weak spots» (black) and «Back to Lecture Lab», then «What you missed»
  on hairlines (the right answer in green with a tick) and the key points on grey panels. An empty
  pool is the dashed cube card.

## Pairs (`/study/pairs`)

A matching game made from the learner's own flashcards (`src/components/pairs`, rules in `src/lib/pairs/game.ts`).

- **Three steps:** the big card (name, one line, the Uzyra logo (`UzyraMark` with the `UzyraWordmark` name under
  it, white) between two puzzle pieces, and a white "Play" button with a lip), then "Choose what to play" (the flashcards `PickerBoard`, read-only, with a sticky bar: how many
  cards are ready and "Start", which needs 5 cards), then the game, then the result.
- **Game palette (a documented exception, like Wordcraft's word colours):** the big card and the result card use a
  blue gradient (`#4a9df0` to `#2a5e98`); the clock is green `#6dcf3f`, orange below 30 %, red below 10 %; the
  progress track fills gold; right is green `#58c43a` on `#e7f8dd`, wrong is red `#e5484d` on `#fde9e9`. "Picked"
  uses the site accent. Colour is never the only sign: right cards leave, wrong ones shake, and a live region says
  which.
- **Board:** two columns, five rows; card fronts in the first column, backs in the second, each column shuffled.
  Cards are white with a 2px `#e6eaf0` border, a 4px bottom lip and 16px corners, centred text clamped to three
  lines; one text size for the whole board (set by its longest card). Card height follows the screen so the board
  fits without scrolling on phones and iPads.
- **Top bar:** back, a progress track (gold fill, from the reading side), the score as a number with "points", sound
  on/off. No coins or money anywhere.
- **Clock:** a bar down the **left** edge of the screen (in Arabic too) that empties from the top, with the seconds
  in a small pill beside its top. 60 s to start, +2 s for a right match, -2 s for a wrong one, at most 90 s.
  It pauses while the tab is hidden.
- **Scoring:** 10 a match, 15 from three in a row, 20 from five in a row. Two cards with the same back are both
  right. The best score is kept per device and language.
- **Sounds** (Web Audio, mute button): right and wrong are the main ones and play the moment the second card is tapped
  (the audio wakes on the first touch of the board): a quick rising "ding-ding" that goes a semitone higher with each
  match in a row, and a short low buzz for a wrong pair; then a tick in each of the last five seconds, a falling three-note "time's up", a run for a
  cleared board. Android vibrates lightly.
- **Motion:** new cards scale in (260ms), right cards pop then leave (300ms), wrong cards shake (320ms), the score bumps
  (220ms); the logo and the puzzle pieces come in once. All off with reduced motion.
- **Result:** the blue card with the score, "best on this device", right / wrong / best streak / accuracy, "Play
  again" and "Change subjects"; under it, the cards that were missed, front = back.

## Repeat (`/repeat`)

A speaking game on `/games` (`src/components/repeat`, matching and sentences in `src/lib/repeat`).

- **Flow:** an intro (title «كرر», one line, the card drawing, three step pills, a teal "Start" button with a lip;
  the tap wakes the audio and asks for the microphone), then ten cards, then a result list.
- **A card:** white, 24px corners, on a soft blue wash. Uzyra says the sentence (label «Uzyra عم تحكي…», words
  near-black `#14141f`); then the microphone opens (a soft tick, label «كرر العبارة…» in Uzyra blue with a pulsing
  red dot) and the words turn grey `#a7acbd`. Each word turns near-black the moment it is heard, in order, and
  stays black. All said: a green tick `#1f9d57`, «أحسنت! إجابة صحيحة» / «رائع», a two-note ding, and after 1.1 s
  the card stays above (with its Arabic meaning) and the next one rises in below (420ms, fade only with reduced
  motion). Silence (8 s before the first word, 3.5 s after the last) leaves the card «لسا مش كاملة» with ▶ to try
  again.
- **Controls** (always left to right, as on a player): ↺ hear it again, ⏸ pause / ▶ try again, ⏭ skip (only after
  the first try). «إظهار الترجمة» shows the Arabic. A fixed bottom bar: progress track and "n/10 · m:ss".
- **Voice:** the site's speech model through `/api/german/tts` with `lang: "en"`, kept in Cache Storage
  (`uzyra-repeat-voice`) so each sentence is fetched once; guests get the browser voice. **Hearing:** the browser's
  live speech recogniser (`en-US`); without one, a recorded clip is transcribed once by `/api/german/score`
  (`language: "en"`). Matching forgives contractions, numbers, sound-alike words and near spellings of long words.

- **German:** a German learner (learning language `de`) gets German sentences (`SENTENCES_DE`, 80,
  with Arabic meanings), the German voice and `de-DE` listening; the matcher reads "geht's" as
  "geht es", ä as ae (ö, ü, ß too), German numbers and das/dass. Nothing is fetched before the
  account's language is known.

## Wordcraft (`/wordcraft`)

German learners get German words: a hand-picked list of about 245 A1–B1 words (`lexicon-de.ts`,
Ä Ö Ü as letters of their own, no ß), German AI words, German decoys (`DICTIONARY_DE`), German
plural rules, a German voice and nouns shown with their capital ("Haus"). Recent words are kept
per language.

A word-path game for learning English words (`src/components/wordcraft`, engine in `src/lib/wordcraft`).

- **Rules the screen must show:** letters join up, down, left or right (no diagonals), every tile is used once, every
  round has one answer. The help panel (the "?" button) says this, plus the keyboard keys.
- **No levels:** the page asks for a difficulty only: Easy (four 4-letter words, 4 × 4), Medium (four 5-letter words,
  4 × 5), Hard (5, 6, 6 and 7 letters, 4 × 6, the most tangled of several grids). Three grey cards, each with a
  small grid of white squares showing its size. Every round is new and random.
- **Where the words come from:** signed in, Groq suggests words for the level (`wordcraftRound`), the engine keeps
  the good ones and proves one answer. When the AI cannot help, the round comes from the built-in list and a
  quiet line under the board says so. The game needs an account: signed out, `/wordcraft` goes to the sign-in page. The next round is made while the current one is played.
- **Waiting:** the guide says "Getting your words ready…" and the empty board (the level's size) breathes softly.
- **Board:** grey `#f4f4f8` panel, 24px corners; tiles are white, 14px corners, a 3px bottom lip, Inter Tight 700.
  The tile size follows the screen (46px floor on phones, 96px cap), the grid is always left to right, even in Arabic.
  The path being traced is the one blue accent (tiles turn blue, a blue connector shows in the gaps); the word
  being traced sits above the board in blue capitals.
- **Found words:** the soft category colours (`CATEGORY_COLORS`: teal, amber, violet, rose, sky, green) tell the found
  words apart on the board and in their slots. This is the one place a page uses colours besides the accent, and it is
  allowed because the colour is never the only sign: the slot also fills with the letters and gets a tick.
- **Slots:** one row of small grey boxes per word with its Arabic meaning under it; two columns.
- **Guide:** the Uzyra mark (`UzyraMark`, white in a 44px ink circle) with a speech bubble (a live region): grey for
  guidance, soft green for a found word,
  soft amber for a miss. Messages say what happened: "right word, but that route blocks the grid", "a real word,
  not one of this round's", "not one of the words".
- **Input:** drag across tiles, or tap them one by one (tapping the last tile again sends; a tapped word that matches
  sends by itself), or the keyboard (arrows, Space adds, Enter sends, Backspace removes, Escape clears).
  The board has `touch-action: none` and no text selection.
- **Smart hint:** the first press shows a word's first two letters, every press after it one more letter, up to the
  whole word; then the next word (slot order, found words skipped) starts again with two letters. The letters show
  numbered on the grid (blue ring) and in the word's boxes (soft blue), so the player still traces the word.
- **Motion:** the letter just added to the path pops (160ms); a found word's tiles ripple once in order (45ms apart),
  then its letters fly into the slot (320ms, strong ease-out, 30ms stagger); the letters a hint just showed glow once;
  a miss shakes the board (200ms); two or more words in a row make the guide's bubble pulse once. All of it is off with
  reduced motion, and so is the waiting pulse.
- **Sounds** (Web Audio, no files, mute button): tracing plays a rising pentatonic tune, one note per letter, and a
  softer lower note when a step is taken back; a found word rings, brighter for two and three in a row (the guide says
  "Two in a row! 🔥"); the right word on a blocking route plays a two-note "almost"; a miss is a low soft knock; hints
  chime once per letter shown; undo steps down; a finished round plays a short run. Android phones also vibrate
  lightly per letter and per word.
- **Mixed text:** English words inside an Arabic sentence (and Arabic inside English) are wrapped in direction
  isolates, and the guide's bubble takes the page direction, so "STORY = قصة" never comes out scrambled.
- **End of a round:** "The words you found": each word with its meaning, an example and its Arabic, and a speak
  button. Then "New round" (blue, same difficulty; the page goes back to the top) and "Change difficulty".

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
- Header: the shared 60px bar and 14px type from the blog.
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

**The home page's look (Nov 2026, `library-look.css`, everything under `.lb`).** This sits on top
of the rules below and replaces their look where they differ:
- **Top:** `PageHero` (the home field of marks, «[cube] Library», «Read real books at your level.»
  word by word, the lead). Under it the search is one white pill with a soft shadow: the field,
  «/», a round «Filter» pill (an icon on phones) and a black «Search» pill. Under that a strip in
  mono numbers: books, languages and the levels on offer (from the library's own counts; hidden
  until known).
- **Ways in:** the category pills stay under the top bar while the page scrolls (a white, blurred
  band); the chosen one is black; counts are mono.
- **Book of the week:** a black card (32px corners): the home field of marks in white gathered
  round the book, a soft light behind it, the book floating and leaning toward the pointer (not on
  touch), a line of light down the cover once when the card is first seen; a translucent «Book of
  the week · category» tag, the title light and large in white, chips as outlined pills (the level
  white), and a white «Open the book →» pill.
- **Shelves:** a 26px light title, the count in a grey mono pill, «See all» as a hairline pill; the
  row fades at its edges and, with a mouse, has round arrows that move it a screen at a time (each
  only while there is more that way); the books stand on a glass rail (a hairline with a soft
  reflection) and lift and turn a little on hover. Shelves rise in as they reach the screen.
- **Lists, buttons and empty states:** pills everywhere (black for the action), mono page numbers,
  a dashed white card for «nothing here».
- **The book's window:** white with a hairline and 28px corners over a blurred backdrop, the title
  light and large, chips as pills, a black «Start reading».

**Learning language:** the discover shelves show the books in the learner's learning language
(`discoverIn` in `library-language.ts`; empty shelves drop out), under a line «كتب بالألمانية» with
«اعرض كل اللغات». With no book in that language the shelves show every language with «لسا ما في كتب
بالألمانية بالمكتبة، هاي كتب بلغات ثانية.». Search, categories and filters are unchanged. The home page
follows the same language for a learner who has chosen one (the tap-a-word hero, the saved words, the
sample lesson window, the voice band's first bubble); guests see both languages.

Real books grouped on shelves, a little more colour than the other app pages but the same calm,
serious system (white page, ink, the home calm scale). Colour comes from the covers and from each
category's own tone, used only as a dot on its chip, a small tinted icon square and a thin line
under its shelf (8 fixed tones in `src/lib/books.ts`). No points, coins, streaks or hearts.

- **Top:** a small eyebrow, the title (28–38px semibold), one lead line; a 48px search field
  (1.5px ink border, «/» jumps to it), an ink «ابحث» button beside it — searching happens only on
  that button or Enter, never while typing — and a «فلترة» button (icon only on phones) with the
  number of chosen filters. «فلترة» opens a grey panel of chips: category, level A1–C2, language,
  length, tags. Several chips in one group widen the list (OR); groups narrow it (AND). Each chip
  shows how many books it would give (counted with the other groups' choices); a chip that would
  give none is faded and disabled. A one-line note under the panel says so in words.
- **Ways in:** a chip row under the top — «اكتشف» (the shelves), «كل الكتب» with the total, then
  one chip per category with its dot and count (a category on its own). The chosen one is ink.
  Chosen filters show under it as ink pills, each with its own ×, then «امسح الكل».
- **Book of the week:** one grey panel with a soft tint of its category, the book large, a tag,
  title, author · year, chips (level in ink, pages, about N hours, language), three lines of
  description and «افتح الكتاب».
- **Shelves (اكتشف):** the book of the week, the admin's shelves, «مختارات لك» (12 picks in this
  visit's order, with «اقتراحات جديدة» on the right of its head to draw new ones; the order stays the
  same for the whole visit), «الرائج هالأسبوع» (amber, a flame icon) and «الأعلى تقييماً» (rose, a
  star icon; only books with at least three ratings, and hidden when none has), «وصل جديداً» (from six books on), one per category in the admin's order
  (12 books, with the full count and «عرض الكل»), then «كتب ثانية» for books without a category. A
  row scrolls sideways with snap. Pins and exclusions set by the admin apply here and in a
  category, never in search or «كل الكتب».
- **The book object** (`BookObject`): one frame for every book — 2:3 cover with 3/8px corners, the
  binding's shadow on its left edge, a sheen, page edges under and beside it, a soft shadow on the
  shelf, the level on a white tag. Only the cover picture changes; without one the cover is cloth in
  the category tone with the title between two thin rules. Title 14.5/600 (two lines), author 12.5.
- **Lists (search, a category, all books):** a head with the title («نتائج «…»», the category
  with its tinted icon, or «كل الكتب»), the count, and an order select (best match for a search,
  recommended for a category, newest, by title, shortest). A grid of 24 (or 48) books, then a pager:
  «السابق», «صفحة X من Y», «التالي», and «بالصفحة 24/48». Moving to another page scrolls to the head;
  while it loads the old page stays, faded. The pages of one list keep the moment it started, so
  books added meanwhile never shift them. An empty result says so with «امسح البحث». Everything
  lives in the address (`?q=&cat=a,b&level=B1,B2&lang=&len=&tag=&sort=&view=all&page=&size=`), so
  back, refresh and shared links return to the same list.
- **Details** (`BookSheet`): a dialog (a bottom sheet on phones) with the book, its facts and
  «ابدأ القراءة», which opens the PDF through a ten-minute signed link (visitors are asked to sign
  in; without a file the button says the file is not ready). With the phase 3 database: a rating
  line under the facts (a gold star, the average to one decimal and «N تقييم»; with fewer than three
  ratings it says so in words instead), «للمفضلة» beside «ابدأ القراءة» (a heart; rose tint and
  «بالمفضلة» when on), and under a hairline «تقييمك»: five 44px star buttons (a radio group, arrow
  keys move it; tapping the chosen star again removes it, as the hint under them says). Visitors see
  the same row with «سجّل دخولك لتقيّم», and a tap asks them to sign in.
- **Admin on a book without a file** (`BookFileUpload`, shown only to an admin): in the sheet's
  action row the primary button is «ارفع ملف الكتاب» (an upload icon) in place of the disabled
  «الملف لسا مش جاهز» that readers and visitors still see. Under the row, after every button, a
  13px muted note (RTL): «للأدمن: الكتاب لسا بدون ملف. ارفع PDF (لحد 500 ميغا) وبنجهّزه للقراءة
  تلقائياً.» States: *uploading* — the button turns to a spinner «عم نرفع… 42%» (disabled), a
  secondary «إلغاء» beside it (it also removes the part already sent), and under the row an 8px
  rounded bar in the accent colour (`role=progressbar`, a 200ms width transition, none under
  reduced motion) with the file name and «خلّي الصفحة مفتوحة لحد ما يخلص.»; *error* — the reason in
  bold #8c1a31 (`role=alert`: not a PDF, empty, over 500 MB, the server's size limit, a lost
  connection) and the button says «جرّب مرة ثانية»; *done* — the sheet shows «ابدأ القراءة» and
  the book can be read at once. Closing the sheet does not stop an upload; a browser warning
  appears if the tab is closed mid-upload.
- **Starter shelf** (`supabase/starter-books/books.json`, `docs/books-starter-library.md`): 20
  well-known books with their covers (`public/book-covers/<slug>.webp`, 600×900, the address saved
  in `cover_path` as `/book-covers/<slug>.webp`, which the page serves as it is) and short Arabic
  descriptions, in six shelves with a mix of kinds (strategy and wisdom, classic novels, mystery,
  gothic and horror, adventure and science fiction, fantasy). 19 are public-domain editions
  (Standard Ebooks); «The Book of Five Rings» is a draft with a drawn cover until the admin uploads
  a file they have the right to use. Covers are 2:3 and show their own title band: no overlay is
  added by the page.
- **Labels are black and white:** the Uzyra mark replaces every category and shelf icon; the book sheet's
  category label is a black pill with the white mark and name; shelf heads show the white mark on a small black
  square; category buttons have black dots; shelf boards and sheet backgrounds lose the category tint. Covers
  without a picture keep their category's cloth colour.
- **Recently read («آخر كتب قرأتها»)** (signed in only): the first shelf of «اكتشف», drawn like any shelf, with a
  grey pill «كتبك المرفوعة: 1 من 2 · إلك إنت بس». One row: the reader's own books (always) and the five library
  books they read most recently (`book_reading_progress`, on the account), newest first (`recent-reads.ts`); an
  own book counts from when it was last read on this device (else from its upload). Under each cover «صفحة 34 من
  80» with a 3px ink bar of how far they got. A library book opens straight at its page; an own book carries a
  small lock on its cover's top corner (the bin on the other) and opens its window as before. With nothing read
  and no book of their own, the row holds only «ضيف كتابك» and «الكتب اللي بتقرأها بتطلع هون.»
- **Your books** (migration `20261118120000_books_user_books.sql`) live in that row. Two books at most,
  PDF, 50 MB each; the database enforces it (slots 1 and 2, the file only at `<user>/<book>/book.pdf` in the
  private `user-books` bucket, 10 adds a day). Covers are page 1 drawn in the browser and kept on the device.
  - Adding: a dashed book-shaped card «+ ضيف كتابك» opens the file picker; the book is added at once with its
    name from the PDF or the file, and the card shows the share sent and a stop button. A failed upload leaves
    the book «ما كمل الرفع» (tap it to choose the file again, or delete it).
  - Two books: the card turns into «الحد كتابين · احذف واحد منهم لتضيف كتاب جديد»; tapping it makes both bins
    pulse and says so in one line.
  - Deleting: a 36px bin (44px target) on each cover, and «احذف الكتاب» in the book's window; one confirmation
    («متأكد بدك تحذف الكتاب؟» with the name; «احذف» red, «لا» focused). The file goes first, then the row.
  - The book's window: the cover, «كتابك · خاص», pages and size, «اقرأ» (blue), «غيّر الاسم», «احذف الكتاب».
  - Reading (`/books/mine/<book>`): the same full reader as a library book (Uzyra on the left, the page on
    the right with the divider; two tabs on phones; slides, the circle, explain / cards / questions, the
    contents from the PDF's outline, search, bookmarks). The pages are drawn on the device from the PDF
    (`my-book-source.ts`: one page at a time, at the width the screen needs, the page on screen first);
    bookmarks and the reading place stay on the device. Uzyra's answers send the page's text with the
    request; the server checks the book is the reader's own and ready, and counts it in the same
    allowance as library books (`books_take_my_study_quota`, migration
    `20261120120000_books_my_book_study.sql`). Before that migration Uzyra says it is not active yet.
  - Opening (`BookOpening.tsx`): the reader's own layout at once (top bar, Uzyra's column at the saved split
    beside an empty sheet that breathes), with Uzyra's cube thinking in its usual place and one line under it:
    «عم بفتح الكتاب…», «عم بنزّل الكتاب… 40%», «عم بجهّز أول صفحة…». The reader then takes its place with the
    cube where it was. No spinner screen.
  - Speed: the file is kept on the device (Cache Storage, `my-book-file.ts`) right after an upload, or
    downloaded in the background once the first page is on screen; later visits open from the device. It goes
    when the book is deleted. The outline is read after the first page. pdf.js uses one shared worker, given
    10 s to start; otherwise it runs on the page (remembered for a day), with drawings capped at 1100 px and a
    short pause between them so taps and selection get through.
  - `?debug=1` on the address shows a small panel: worker or page, file from device or network, times to open
    and to the first page, the slowest drawing, and words found per page (0 means nothing to select).
- **Cards** show a small gold «★ 4.6» under the author once a book has three ratings.
- **«مفضلتي»** (signed in): a chip with a heart and the count in the ways-in row; its list is a
  normal paged list, and an empty one explains how to add books.
- **Manual shelves:** shelves the admin fills by hand come after the book of the week and before
  «وصل جديداً», in the admin's order, with an indigo tone and a bookmark icon. Only published books
  show; an empty shelf is left out. A shelf with a period shows only during it (server clock).
- **Admin preview:** `/books?preview=<ISO time>` shows an admin the library at that moment (shelves
  and book of the week by their periods) under a dashed strip «معاينة للأدمن» with «اطلع من
  المعاينة». Readers never see it; the address is ignored for them.
- **Admin** (`/admin/books`, Arabic, RTL, the `edith-premium` admin look): four underline tabs
  (`?tab=`):
  - **الكتب:** a grey filter card (search by title, author, alternate title or ISBN; status,
    category, level, language and "missing" selects, two per row on phones), the count when
    filtered and «امسح الفلترة». One list row per book: checkbox, the small book, title, a meta
    line (category · author · level · pages) and badges (status in words and colour: منشور green,
    مسودة grey, مؤرشف violet; كتاب الأسبوع gold; بدون PDF red; بدون غلاف / الحقوق مش مراجعة grey),
    then 44px icon buttons (order arrows inside a category, only while nothing is filtered;
    publish/draft; edit; delete). Choosing books shows a sticky bar with one action select
    (publish, back to draft, archive, set the primary category, add or remove a tag) and «طبّق»;
    books that are not ready are skipped and named in a toast.
  - **التصنيف:** categories (names, tone, icon, order; deleting one with books asks where they
    move, inline, never a second window) and tags (Arabic and English names, book count).
  - **ترتيب المكتبة:** the book of the week (a published book and an optional from/until period;
    a badge says if it is on show now), manual shelves (name, shown or hidden, period, books in
    order with arrows), pins and exclusions (choose the place — «اكتشف» or one category — then two
    hairline cards side by side, «مثبّت أول» with order arrows and «مخفي», each rule with its
    period and an «شغّال هلأ» / «برا مدته» badge; a grey card adds a rule: pin or hide, the book,
    from/until), and the preview link with a date, a time and an optional picks order.
  - **الإحصائيات** (phase 3): «آخر 7 أيام / آخر 30 يوم», four number cards (views, reads,
    favourites, ratings: label, value 34px/600, what it counts, and the change from the days before
    in words), «الرائج هالأسبوع» and «الأعلى تقييماً» as numbered hairline lists, the stars
    spread as five gold bars with count and share, and published books nobody opened as pills.
  - **الاستيراد والجودة:** a CSV import (choose the file, match each field to a column, choose
    what happens to a book that exists — leave it, update it, or add a copy — then «جرّب بدون
    حفظ», which shows the counts and a row table with words for every reason, and only then
    «استورد N كتاب»); the last ten imports; the quality cards (drafts not ready, no PDF, no cover,
    no ISBN, likely duplicates) with lists that open the editor; and the file-cleanup list with
    «جرّب تشيلهم هلأ».
- **Book editor:** one window (a bottom sheet on phones) with five numbered sections — identity
  (title, alternate title, author, ISBN, language, pages, year, description), classification
  (primary category, level, secondary categories and tags as toggle chips), files (a hairline card
  per file with its state and «اختار ملف» / «بدّل», a progress bar while it uploads; the cover up
  to 5 MB, the PDF up to 500 MB; files over 6 MB go up in resumable parts, and a failed upload says
  why in words — over the project's size limit, or no resumable uploads for a file over 50 MB),
  availability (draft / published / archived choice and the rights
  check) and display (book of the week with its period, manual shelves). Beside it: the live book
  and a readiness card (title, primary category, rights — green tick or red cross with words; then
  what is worth adding but never blocks). Save and cancel stay at the bottom.
- Data: `book_categories` and `books` (migration `20261108120000_books_library.sql`), then phase 1
  (`20261109120000_books_admin_foundation.sql`): status, alternate title, ISBN, rights check,
  tags, secondary categories, manual shelves, the book-of-the-week period, imports and the
  file-cleanup list. Covers in the public `book-covers` bucket, PDFs in the private `book-files`
  bucket. Everyone reads categories and published books; only admins write. Phase 2
  (`20261110120000_books_discovery.sql`): the search copy and its indexes, `books_browse`,
  `books_discover` and `book_editorial`. Phase 3 (`20261111120000_books_popularity.sql`): events,
  favourites and ratings (people's own rows), the public numbers per book and per day (no
  identities), `books_popular`, `books_track`, `books_rate`, `books_favorite` and `books_analytics`.
  The page and the admin keep working on a database that
  only has the earlier migrations (the lists are then built in the browser, with a dashed notice
  for admins).
- **Reader** (`/books/<book>/read`, migration `20261113120000_books_reader.sql`): the study page's
  layout for a book — the same top bar (back to «المكتبة», the book's name as a 15px line), Uzyra on
  the left and the page on the right with the draggable divider (40/60), two tabs «الكتاب» /
  «يوزرا» on phones, and the floating circle over both.
  - **The page:** one sheet of paper (4px corners, a hairline ring and a soft deep shadow) on the
    study grey, with 12px around it (8px on phones). By default the page is as wide as its pane
    (scroll down for the rest: a whole page fitted to the height left wide empty margins on a tablet
    and words too small to read); «الصفحة كاملة» shows the whole page instead (remembered per
    browser), and zoom goes up in five steps. A zoomed page scrolls from the side its lines start on.
  - **Progress:** a 3px accent line under the top bar grows with the page number, from the side
    the book starts on.
  - **Turning:** instant. The sheet takes the new page's size at once and slides in 24px (220ms,
    `cubic-bezier(0.2, 0.8, 0.2, 1)`; a 120ms fade with reduced motion). Pages read ahead appear
    sharp straight away; otherwise the sheet takes the page's own main colour and shows a
    blurred preview of the real page (its ThumbHash, 10px blur) — or, on books prepared before
    the sizes, the page's real lines faint (8% ink, "ghost text") — until its picture is decoded,
    then it fades in (200ms). Zooming keeps the picture on screen while the bigger size comes. A small ring in the sheet's corner appears
    only after a second; a page that cannot load shows an ink pill «ما قدرت أفتح الصفحة · جرّب
    مرة ثانية» (after one quiet retry), never a broken picture. While flipping fast, the page
    number shows in the middle of the page («12 / 340», from the second quick turn, gone 600ms
    after the last).
  - **Turning by touch** (touch only; a mouse selects): a sideways swipe across the page turns
    it — the sheet follows the finger a little (40% of the travel, at most 48px), turns past 60px
    (sideways more than twice up/down, quicker than 600ms or faster than 0.4px/ms) with the usual
    slide, or settles back (160ms). A tap on the outer 12% of either side turns too; a page taller
    than the pane (phones, fit to width) scrolls 85% of the pane first and turns from the bottom.
    The book's direction decides the sides (in a right-to-left book, swiping right and the left
    edge go on). No page beyond: a 12px nudge and back (180ms). Selection always wins: nothing
    turns while text is selected, after a 300ms long press, from a button, or with the circle's
    menu open; a zoomed page moves inside its box and turns only from its edge. Reduced motion:
    no following, a short fade for the nudge. On touch screens the first-visit tip adds «اسحب
    الصفحة أو اكبس على طرفها لتقلب.»
  - **Progress line** fills from the side the book starts on (left for left-to-right books).
  - **Scrubber:** the progress line is also a slider (no new bar). A 28px band around it takes
    the pointer; pressing thickens it to 6px with a 14px accent knob (white ring), and a card
    follows the pointer under the line: the page's 160px picture shown 120px wide (same sheet
    corners, hairline ring and shadow; its blurred preview until the picture is in) over an ink
    pill «صفحة 412 من 900 · <chapter>» (one line, the chapter cut with «…»). The page is fetched
    only on release; a click jumps; hovering on a computer shows the card without jumping;
    Escape while dragging goes back. Keyboard: it is a `slider` («صفحة n من N»), Home/End go to
    the first/last page, the arrows still turn one page. The card appears in 120ms (opacity and
    0.96→1 scale; opacity only with reduced motion); the tip and the page-number toast step aside
    while it shows. Books prepared before the sizes show the number and chapter only.
  - **Contents** (only when the PDF has an outline): a list icon («الفهرس») first among the bar's
    tools. On an iPad or computer it opens a 320px white panel above the button (14px corners,
    hairline ring, deep soft shadow; up to 70% of the height, scrolling inside); on a phone a
    sheet from the bottom (16px top corners, the page dimmed 20% behind it). Title «الفهرس», a
    muted line «باقي ≈ n دقايق بالفصل» under it when known, ✕. Each row: the title (its own
    direction, two lines at most), its page in muted tabular figures, 44px tall, sub-entries
    indented 14px a level (3 at most). The chapter you are in is bold with a 3px accent bar on
    its start side and opens in view, focused. A tap goes there and closes; Escape, ✕ or a tap
    outside close; ↑/↓ move between chapters. Opens in 160ms (opacity, 0.97→1 from the button;
    the sheet rises in 220ms); reduced motion: opacity only.
  - **Chapter ticks** on the progress line: 1px marks in 25% ink where each top-level chapter
    starts, at least 6px apart (the rest are left out), mirrored for right-to-left books.
  - **Minutes left:** «باقي ≈ 6 دقايق بالفصل» (or «للآخر» in the last chapter) after «من N» in the
    bar when it is wider than 680px, and under the contents' title. From the reader's own pace in
    this browser: the last 10 pages read for 2 s to 5 min each, shown after 3.
  - **The panel** (one button, first among the bar's tools; «الفهرس والبحث» with the list icon, or
    «بحث وعلامات» with a magnifier when the PDF has no outline) holds three tabs under its title:
    «الفهرس | بحث | العلامات» (2px ink underline on the chosen one, muted others, a grey count
    pill on «العلامات»). It opens on the contents, else on search.
  - **Search:** a 42px field (1.5px line, accent when focused, 16px text), whole words on Enter.
    Rows: the page's 160px picture at 32×42 (3px corners, hairline), «صفحة n» bold 13px and two
    muted lines around the match with the word in ink bold. «جاري البحث…», «ما لقيت «…» بهالكتاب.»,
    «أول 50 صفحة» when capped; before the database has it: «البحث بيشتغل بعد تحديث قاعدة البيانات.»
    A result goes to its page and marks the word there with the selection's tint until the page
    turns.
  - **Bookmarks:** a bookmark icon after the panel's button, filled in the accent when the page is
    marked (`aria-pressed`). Marking shows an ink note «انحفظت صفحة n · تراجع» over the bottom of
    the page for 3.5s; marked pages are 5px accent dots (white ring) on the progress line; the
    «العلامات» tab lists them (picture, «صفحة n», the chapter) with ✕ to remove. Hidden before the
    database has bookmarks. Below 640px the bar drops the word «صفحة».
  - **Back where you stopped:** opening at the saved page shows «رجعتك لصفحة n · من الأول» for 4s.
  - **Milestones:** the first time past 25/50/75% and the last page, the line swells once (400ms;
    none with reduced motion); the last page also says «خلّصت الكتاب 🎉».
  - **Zooming by finger** (off until tried on a real iPad; per browser, localStorage
    `uzyra-book-gesture-zoom` = "1"): a double tap off the words goes one zoom step up (back to the
    first after the last); a pinch scales the sheet with the fingers and settles on the nearest
    step; never with text selected.
  - **The bar under the page:** «السابقة» (outlined) · «صفحة [n] من N» (the number is a field) ·
    «التالية» (ink, the main action), all 44px, laid out in the book's direction; on the other side
    «على قدّ العرض / الصفحة كاملة», «صغّر», «كبّر» as 44px icons. When the bar is narrower than
    520px the buttons keep only their arrows. Arrows and Page Up/Down turn pages.
  - **Selecting:** the page's words lie see-through over the picture, each piece stretched to the
    width of its words as the browser measures them, so selection matches the picture in Chrome
    and Safari. Selecting is the lessons' own (`tech-select.ts`): a pen or mouse presses on a
    word and drags, a finger holds a quarter of a second then drags (a plain swipe still turns or
    scrolls), a double tap picks the sentence and a single tap clears. Every selected word gets
    a thin glowing blue box (#2b6df0) joined to the next by a wire, each new word makes a short
    «تي» and the end a chirp; the browser's own selection colour is hidden. In Uzyra's answers
    (left column) the same selection is dark red (#8e1b2b), the circle and its ring turn red, and
    a request about it sends that answer as the text (as in the lessons).
  - **Hints:** on the first visit an ink pill at the top of the page area says «حدّد أي كلمة أو
    جملة بإصبعك أو بالماوس، وبعدين اكبس على الدائرة» (× closes it; the first selection retires it
    for good). A picture-only page carries a small dark pill «صفحة صورة بدون نص، ما بتنحدد».
  - **The circle:** «اشرحلي», «معنى ونطق», «فكّك الجملة», «ليش هيك؟», «بالعربي», «فلاش كاردز» and
    «تمارين اختيار». Uzyra answers in writing in her column (the request as a grey bubble with its
    tag, her answer under her mark with «صفحة n»); cards and questions open in the lessons' practice
    window.
  - The place is saved for the reader and kept in the address (`?page=`). The book's sheet says
    «ابدأ القراءة» for any book with a file (opens the reader) with «افتح ملف PDF» beside it.
- **Read straight from the PDF** (`library-book-source.ts`, the same page source as a reader's own
  books): a library book is read from its PDF, opened in parts from a 12-hour signed link, each
  page drawn on the device with its words (selectable from the first page). There is nothing to
  prepare: a book can be read as soon as its file is saved. While it opens, the reader's layout
  shows Uzyra's cube with «عم بفتح الكتاب…» / «عم بنزّل الكتاب… n%» / «عم بجهّز أول صفحة…». The
  place and bookmarks stay on the reader's account; a selection sends the page's own text to
  Uzyra. After the first page shows, the file is kept on the device (Cache Storage
  `uzyra-library-books`, books up to 50 MB, the three most recent), so the next open does not use
  the network. A book with only prepared pictures and no file still reads its pictures. pdf.js'
  page words need `src/lib/pdf-stream-polyfills.ts` on Safari (without it: «undefined is not a
  function (near '...n of e...')»).

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

## Path quiz page (`/path-quiz/$itemId`)

A quiz stop on the lesson path (Lecture Lab questions) opens on its own page, in the home page's
language: white, a still field of faint black dots at the edges (24px, 20px and only at the top on
phones), the question in Google Sans Flex 450 (40px down to 26px), black pills for actions.

- **Top:** back to the path (asks first if answers would be lost), the stop's name, a sound switch
  (the shared `tech-sound` setting). Under it, one 6px segment per question: ink for the current
  one, green when answered right, red when wrong.
- **Question:** Uzyra's cube (48px, 56px from 1024px) beside «Question 3 of 10»; it thinks while
  the answer is checked, hops on a right answer and shakes its head on a wrong one.
- **Answers:** 16px cards with a hairline border and a letter in a circle. The chosen one gets a 2px
  ink border. After checking: the right answer green with ✓, a wrong choice red with ✗, the rest
  faded; the list shakes once on a wrong answer. Keys 1–8 or A–H choose, Enter checks and goes on.
- **Action bar:** fixed at the bottom on every screen (the thumb's reach on phones): «Check», then
  the result («Right!» / «Not this time» with the right answer and the explanation) and «Next».
  The bar turns soft green or soft red. Sounds: `rightAnswerSound`, `wrongAnswerSound`, then
  `quizDoneSound` on the result page.
- **Result:** the cube, the score counting up (for example 8 / 10), one line about it, «Back to
  the path» and «Try again», then the questions answered wrong with the right answer and why.
- **States:** a grey loading shape, a load error with «Try again», «No quiz here yet».
- Green and red only mark answers, always with a word and an icon. Marking stays on the server
  (`answer_path_quiz`). Reduced motion: no hop, shake, rise or count-up; colours and sounds stay.
- A stop that holds both quiz and clips, and film/GIF stops, still open in the path's window.

## Path film & GIF page (`/path-clips/$itemId`)

A film & GIF stop opens on its own page, built on the quiz page's shell (dots, top bar with back and
sound, fixed action bar, answer cards, result, sounds and the cube's reactions).

- **Stages:** three pills, «شاهد · افهم · تمرّن» (Watch · Understand · Practise): the current one
  ink, the finished ones with a green ✓. Under them a thin ink progress bar and a ✓/✗ tally.
- **Watch:** each clip in a 20px-radius dark frame (16:9, at most 56% of the screen's height; 16px
  and 42% on phones) with a white round play button, then chips: replay, «ببطء» (0.75×). A
  subtitles switch (English · عربي · both) above the sentence in the headline face, the target word
  marked in soft yellow. A word card: the word → its meaning, and the scene's context. The credit.
- **Understand:** meaning (choose the Arabic), listen (no subtitles: choose the sentence heard),
  the fitting sentence for a GIF. Three answer cards, keys 1–3.
- **Practise:** fill the gap (the sentence with an underlined input for the target word, case and
  punctuation ignored), word order (dashed answer box, word tiles), speaking (recorded, not
  graded, can be skipped), and once at the end matching up to six words to their meanings.
- **Admin:** in the stop's content, checkboxes choose its exercises (`clip_exercises`; all ticked
  is stored as null = all), and each clip in the list shows the exercises it will make.
- **Result:** the score, «أعد الغلط بس» (a new run of only the wrong steps), «من الأول», the
  words learnt (word · meaning) and the sentences to go over.
- Reduced motion: no shake or count-up; GIFs don't start on their own.

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

## Lesson factory (`/admin/curricula`) and review & publish (`/admin/publish`)

Making lessons and publishing them are two separate pages, each a full page (no side panels), built
like the home page (`lesson-admin.css`, classes `.la-*`; shared pieces in
`src/components/rita-lessons/admin/HomeBits.tsx`):
- **Colour:** black, white and neutral greys only; Uzyra's cube is the one colour. States are words
  and marks, never tints: ink chip = published, outlined chip = ready, a chip with «!» = needs a
  look; red only for a real failure. Book covers without a picture are black/grey.
- **Type:** Google Sans Flex throughout. Page headline 72px (40px on phones) at weight 450, section
  headlines 54px (34px), feature titles 42px (30px); a 15px muted eyebrow and a 19px muted lead.
- **Surfaces:** grey cards `#f3f3f4` with no border, 36px corners (24px on phones), 40–48px inside;
  work areas inside them are white with 28px corners. Black pills for the main action, white pills
  for the rest. The site's own top bar (`ProHeader`, solid, light) on both pages.
- **Motion:** the top of each list page is the home hero's field of marks (`DotHero`, a 2D canvas
  using `ultra-field.ts`: the ring follows the pointer, then drifts), with «[cube] page name»
  above the headline. Headlines come in word by word with a caret (`WordsIn`; Arabic words are never
  split into letters), numbers count up the first time they are seen (`CountUp`), cards rise in
  70ms apart. Reduced motion: everything still, the field drawn once.

**The lesson factory** turns a book's pages into lessons.
- The shelf: the field with «مصنع الدروس», «من الكتاب للدرس.», a lead, black «+ كتاب جديد» and
  «المراجعة والنشر» (with how many wait). Four number cards (books, pages read, lessons made, ready
  to publish: the last opens publishing). Then «كتبك، وكل كتاب وين وصل.» and the books inside one
  big grey frame (like the home's library window): white cards with the cover, title, chips, a black
  reading bar, «N درس · M منشور», and one black pill for what comes next («كمّل القراءة», «اصنع N
  دروس», «كمّل N دروس», «راجع وانشر (N)» or «افتح الكتاب»). A dashed card adds a book. The book
  language check sits under the shelf.
- A book: back, the big cover and the title as the headline, chips, «⋯» to archive it. Then three
  rows like the home's features, «01 / 02 / 03», words and the main pill on one side (sticky while
  scrolling), the work in a white card on the other; the sides swap row by row and stack on phones:
  1. «اقرأ الكتاب»: the share read in big numbers and «كمّل القراءة» / «وقّف» with the live
     status; the work card has the page count, a bar, the page map (ink read, outlined no text,
     grey not yet) and only the problems there are.
  2. «اختار الدروس، واصنعها»: how many are suggested; rows with round black checks, the English
     topic editable with the pencil, and a sticky bar «اخترت N من M» + black «اصنع الدروس (N)».
     A custom lesson and PDF-only guides are folded in «خيارات إضافية».
  3. «الدروس اللي انصنعت»: how many; one row per lesson with its state chip, «كمّل», «شوفه كطالب»
     and «راجع وانشر».
  A black closing card follows when lessons wait («درسين جاهزين للمراجعة.» with a white pill
  «المراجعة والنشر») or when all are published («شوف المسار»). «أدوات متقدمة» stays folded.
- The factory never asks for a lesson kind, a guide to link or exercises: new lessons are the
  guide + Uzyra kind, and exercises live on the path as stops of their own.

**Review & publish** is the last step, apart from making.
- The field with «المراجعة والنشر», «شوف الدرس، وانشره للكل.», a lead and pills to the factory and
  the path. Four number cards (ready, with review notes, published, levels on the path). Then
  «دروس جاهزة للمراجعة.» (or «دروس منشورة بالمسار.»), a centred row of pills: the two tabs in a
  grey track (the chosen one black, with counts), level and book filters, search, and black «انشر
  الكل (N)».
- One grey 36px card per lesson: its picture in a white frame with the level, book and pages, the
  title (opens the lesson) and the English one, «N أهداف · N كلمة · الشرائح ✓», review notes,
  «الكتاب مسودة · بينشر معه» when it applies; white «شوفه كطالب» and black «انشر» (published:
  «منشور · بالمسار بمستوى A1» and «إلغاء النشر»).
- A lesson opens on its own page (`?lesson=`): its picture large on one side, the title, chips and
  three counted numbers (goals, words, pages) on the other; then two grey cards, «جاهزيته» (slides
  linked, goals for Uzyra, review notes, book status, where it goes on the path, as black / outlined
  / grey marks, red only when the slides are missing) and «شو بيتعلّم الطالب» (goals, words,
  pages), and a sticky bar: «انشر للكل», «شوفه كطالب», «⋯» with «تعديل متقدم» (the full lesson
  editor on its own page in a white card, `?edit=true`) and «احذف الدرس».
- Publishing a lesson publishes its book too when it is a draft, and puts the lesson at the end of
  its level on the path. Logic: `src/lib/rita-lesson-board.ts` (tested).

The older book workspace (four steps, `BookWorkspace`) is no longer opened from the factory or the
path; its pieces (reader, lesson maker, review rules) are reused by the new pages.

### The two lesson kinds: red and green

Every lesson is one of two kinds, and one colour marks it everywhere on the book page (tokens
`--kind-*` in `src/styles.css`, section "The two lesson kinds"):
- Red (`--kind-classic` `#d6453a`, text `#a3261c` on `#fdeceb`): "درس يوزرا", Uzyra's lesson with
  exercises, as lessons always were. The default for new lessons.
- Green (`--kind-study` `#1f9d55`, text `#136c3c` on `#e4f5eb`): "ملف + يوزرا", the PDF guide on the
  right and Uzyra on the left. One press makes it in full: the lesson, its exercises, its guide, then
  the guide checked and linked, with the steps shown under the row (`.uz-pipe`). Rules:
  `src/lib/study/lesson-maker.ts`.
The choice is two cards (`.kind-card`, a small picture each: chat lines for red, a page beside Uzyra
for green); a lesson carries a pill (`.lesson-kind`) and its row a 4px edge (`.lesson-row`). A green
lesson whose guide is not linked says "بدون دليل مربوط" and offers «كمّل» (learners get the red lesson
until it is linked). The kind can be changed later in the lesson window, tab «الدراسة التفاعلية».

The free conversation (`/rita-live` without a lesson) uses this same column as a full page
(`.uz-rc-shell`), and since Nov 2026 in the home page's look (`FreeTalk.tsx`, `free-talk.css`, scoped
to `.uz-rc-shell` / `.uz-rc-page`; lessons and books keep the plain column below). White page; under
the site's top bar a row with «محادثاتي» (back), «● مباشر مع يوزرا» in the middle while connected (a
30px white pill, its blue dot pinging; «عم نوصلك بيوزرا…» with a grey dot before Uzyra is ready; only
«مباشر» under 440px) and whether the conversation is saved (red with «أعد المحاولة» when it failed).
No voice orb; the orb stays only on spoken lessons with exercises (`/rita-live?lesson=`).

- **Start screen:** the home hero's field of marks behind the top, its ring hugging Uzyra's cube
  (`useDotField(…, around)`: the ring is measured against the cube, ×2.6) and fading out before the
  controls. The cube large (88–140px, by the screen's width and height) inside a hairline orbit with
  one ink mark riding it (24s a turn) and a soft shadow breathing under it; «◆ محادثة حرة» in a white
  pill; the headline «احكي، ويوزرا بتسمعك.» (Google Sans Flex / Graphik Arabic 450, 30–56px) whose
  words come in one after another; one muted line. Then "Uzyra
  explains in" as one grey track with a black pill sliding under the choice (`ExplanationLanguageControl
  variant="segmented"`, 340ms). On short screens the lead (≤720px tall) and the language's line
  (phones) step aside; whatever is left scrolls, and the cube moves with it. A failed or starting call
  says so right above the circle. There are no topic pills: the site has none, so do not add them back.
- **Hold to start:** the circle is 92px and thin rings pulse out of it while it waits; held, they
  close in on it with the fill (`HoldToStart rings`, the fill in `--fill`) and vanish when it is full.
- **During the call:** before anything is said the empty page says «يوزرا بتستنّاك تحكي.» (or «لحظة، عم
  نوصلك…»). Uzyra's text 15.5px at 1.9, her mark in a 28px black circle; the learner's words in black
  bubbles (radius 22, the last corner 7) and what they are saying now as a white outlined bubble with
  a blinking blue caret. Above the composer, Uzyra's cube (46px) with a halo that grows with the voice
  and nine bars on each side (`CallStage`): blue while Uzyra speaks, ink while the learner speaks,
  resting grey otherwise; what she is doing («بسمعك…», «بتحكي…») under it (not beside her answer).
  The composer is a white 56px pill with the field and a black round send; under it the call's tools
  on a black island: microphone (white circle with a red sign when off), stop Uzyra (while she
  speaks), «كلماتي» with its count, and ending the call as a red circle. The cube follows its spot
  when the composer or a line under it changes (`FlyingCube` watches the part it sits in).

The study page's Uzyra column (`.uz-rc-*`, RitaRealtimeV3 in study mode) follows the ChatGPT / Claude
chat pages, measured from the owner's reference and scaled ×0.82 so the column keeps that calm,
large-screen feel. Page #F7F7F6. Before the call: the UZYRA wordmark and Uzyra's cube big in the
middle, and no message field yet: at the bottom an 84px black circle with the white Uzyra mark
(30px; `HoldToStart`, «اضغط مطوّلاً لتبدأ» under it in 12px #8A8A87). The call starts only by holding
it: held (pointer, or Space / Enter), a white disc grows from its centre to the edge in 950ms (only
its transform moves; the mark turns black where the white covers it) while the circle gives 5%, and
a soft tone (a root and its fifth) rises in pitch and volume with the fill; let go early and the disc
shrinks back in 420ms, the tone falls away and nothing happens. Full, a small rising chord plays, the
circle shrinks away (scale 0.6, fades), a thin 40px ring turns in its place while the call connects
(the same 128px height, so nothing moves), and once Uzyra is connected the composer rises into that
place (460ms). After a failed call the circle comes back empty with «اضغط مطوّلاً لتعيد الاتصال».
Reduced motion: the circle does not shrink and nothing rises; the disc still grows. When the call starts the cube flies down to
sit just above the composer (FlyingCube). Uzyra writes without a bubble: a quiet 12px line first (her mark in a 26px white circle,
«يوزرا», the circle request it answers, and on the newest answer what she is doing now) over a hairline
#E4E4E1, then 13px text #2B2B2B at 1.95 line height, paragraphs 12px apart, bold #161616. Words in the
language being learned are small grey tags (#ECECEA, 0.9em). The learner's words sit on the other side
in a #EBEBEA bubble (radius 15, 8×16 padding, 13px); a circle request shows its label as a small tag
above the quote. Turns are 26px apart; the report link is a small flag. The composer copies the
owner's reference chat box: one #EBEBEA field (radius 28, 16×14×12 padding, no border, no shadow),
the 16px field on top (16px keeps iPad Safari from zooming), then a 46px row with «كلماتي» (36px tall,
14px, and its count) at the start and, at the end, stop, end call and mic as plain grey 36px icons
(end call turns red only on hover) and a 44px round blue send (#6096F0, #A9C4F7 while empty). Uzyra's sheet is a #EFEFED card (radius 16, no shadow)
with white table cells, soft guide-tone head pills and a white «انتبه» tile.
Uzyra's cube (RitaCube) is a flat black block (no shading, no
shadow; a touch wider than tall, slightly uneven corners) with two white rounded eyes, alive from
springs that overshoot and settle: waiting, it does a small random action every 2–4 s (a hop with
anticipation, squash and stretch, a double bounce, a lean, a wiggle, a glance) and blinks fast; it
squashes hard with the learner's voice, rocks with circling eyes while thinking, hops on the beats of
Uzyra's voice, and hops on every change of mood; only the blink stays with reduced motion.
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
- Header on the home page: the blog’s 60px bar, 16px wordmark and 14px link and button type.
  Signed-in controls show a fixed-width voice timer, a globe with the learning language code, and a rounded-square account photo. On phones, the account menu opens from the bottom.
- Uzyra's orb 280px (380 from 768) on a stage 320/360px tall and at most 840px wide; rings 1px.
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


`AppWindow.tsx` replaces the old lesson-path strip. A window built from real markup (no screenshots) that starts tilted (desktop only) and flattens as it scrolls to the middle of the screen, then plays a short story once: the path fills, the lesson in progress shows, two words are saved, Uzyra listens.

- Only `transform` is written on scroll (one rAF, no state); the story uses transitions. The wave on Uzyra's bar runs four times, then stops (the orb stays the only continuous motion).
- Calm motion and no-JS show the finished window flat. Replay is a 44px button.
- Content is sample content and says so ("Sample screen", "Sample lessons and words"). No counts, no users, no testimonials.
- Decorative for assistive tech: `aria-hidden` plus a one-paragraph `sr-only` description.

## Learning home scale (`/learn`, `.uz-learn`)

The same calm scale as the home page: the heavy pieces smaller and lighter, nothing shrunk below
reading size. The header takes the home page's lower bar (60px, 14px links, 38px buttons). Rail:
14px/600 pills (still 44px tall, the touch target), an 11.5rem column from 1024px. Section titles 22/600. "Talk to Uzyra" stage:
30px title on phones, 36px from 768px (weight 600), 15px line, 42px button, 320/340px tall, orb
100px. Tiles: names 16/600 (the lead tile 20), lines 14px, tags 11.5px, 22px corners, 32px go
button, 40px light buttons. Measured at 1180px: stage title 46 to 36, rail 16 to 14, tile name 19 to
16, header 64 to 60.

### Home hero words

Tapping one of the words around Uzyra's orb (Guten Morgen, Danke…) plays a small sound from the
study circle's family (`wordTapSound` in `tech-sound.ts`: a soft falling "pop", then two bell notes a
fifth apart, each word on its own pitch, so tapping them in turn plays a little tune) and the word
gives a springy pop (the `scale` property, so its tilt stays). The sound follows the same on/off
setting as the study page; reduced motion keeps the word still.

## Home "Under the hood" band

`src/components/home/procreate/UnderTheHood.tsx`, after the lesson path. Speed story for Uzyra, told in three parts: a scripted mixed-language transcript demo, an overlap timeline, and five capability cells (one is the measured figure).

- Honest numbers only. The one measured figure (about 75 ms) is the voice engine alone, with its date, region and "not end to end" stated next to it. Latency goals are not shown on the page; add an end-to-end figure only when recorded calls back it.
- Every number is defined where it appears (what is measured, from where to where).
- The demo is labelled as a scripted example. It has a Replay button, a full-text `sr-only` version, and shows the whole text at once under reduced motion.
- Mixed-direction text is grouped by language into `dir`/`lang` spans so Arabic never reorders neighbouring words.
- No vendor names and no compliance claims on the page.

## Motion is always on (owner's choice, Nov 2026)

`src/lib/always-motion.ts` runs in `<head>` before the app: the device's "reduce motion" setting
and Chrome's Data Saver no longer still the site. `matchMedia` answers "no" to reduced motion,
`saveData` reads false, and every CSS `@media (prefers-reduced-motion: reduce)` block is removed
(and "no-preference" blocks always apply), including stylesheets added later. The reduced-motion
rules in this file and in the CSS stay written but no longer take effect on the site.

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
admins «تعديل المسار»), the title «دروسك مع يوزرا» (24/600), and the road. No stars, stats card,
colour legend or slogan on this page (stars are still kept in the database). Each kind of stop has
one colour, used for its 4px ring and its small pill: green «PDF + صوت» (a study lesson: guide +
Uzyra's voice), blue «محادثة» (a conversation lesson), orange «تمارين» (an exercises stop: only its look
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
the language's flag and offers switching language or a free talk with Uzyra. While editing, only the
banners stay on the road, and a + at a level's edge sits above the next banner (it adds to the
level before).

**Redesign (Nov 2026): the home page's language.** The top bar is white glass with a round back
button and outline pills (black when on). A hero opens the page: a grey pill with the level and the
flag, «دروسك مع يوزرا» in Google Sans Flex 450 (56px down to 34px), «خلّصت N من M دروس بـ A1» over a
6px ink progress bar, a black «كمّل · <the current lesson>» pill, and Uzyra's cube (120px, 76px on
phones) floating beside it. Each kind of stop has a shape of its own, drawn in `lesson-path.css`:
conversation lesson = circle, PDF + voice lesson = squircle (30px), quiz = diamond, film & GIF = a
wide 120×78 frame with a strip of holes top and bottom, files = a folder with a tab, a level's finish
= a medal with an outer ring. The layout footprint stays 88px, so dragging and the road are
unchanged. A done lesson has a 5px ring and an ink ✓; the current one is 14% larger with a dashed
halo and «إنت هون»; a lesson still to come keeps a pale ring. The walked road is ink (#121117), the
rest #ececf1, the lights the cube's blue. A level is a #f4f4f7 card (24px corners) with a white 58px
tile holding the level in the display face, its name («مبتدئ · A1»…), the count and a thin ink bar;
«قريباً» is a dashed white card. «انتقل إلى A2» and «متابعة» are black pills with an arrow; the
bottom bar is white glass. Admins' delete is a small red-outline pill under the stop; + is an ink
dashed circle. Reduced motion: the cube, halo and bars stand still.

**Units (Nov 2026), after the big learning apps.** A level is shown one short unit at a time
(`src/lib/rita-path-units.ts`): an admin's «بداية وحدة» stop starts and names a unit (title = its goal,
e.g. «تعريف عن حالك»; learners see it as the unit's heading, never as a stop); without such stops a
level is cut every 5 lessons, quizzes, films and files staying with the lesson before them.
- Learners never see how many lessons a level holds: the hero names the unit («A1 · الوحدة 2» over
  its title, or «الوحدة 2») with «خلّصت 2 من 5 بهالوحدة» and a 6px ink bar, then «كمّل · <lesson>» and
  an outline «دليل الوحدة» pill. The level card (on unit 1 only) says what the level lets you do
  («بآخرها بتعرّف عن حالك…») instead of a count; the finish says «خط النهاية».
- Under the hero, 44px round pills for the units already open (done = black with ✓, the current
  one ringed) and one dashed 🔒 pill after them; never the closed ones beyond.
- The road ends at the next unit: a dashed card (three blurred stops, a black lock on its edge,
  «الوحدة 3», its name or «الوحدة الجاية», «بتنفتح لما تخلّص هالوحدة»), or, once this unit is done, a
  black card with a white «افتح الوحدة 3» pill. Moving between units: the road rises in (or drops in,
  going back) in 600ms, the hero text fades up.
- A unit finished since the last visit gets its moment once (per device, language and level): a
  white card over a blurred page, Uzyra's cube hopping, a burst of ink and blue sparks, «خلّصت
  الوحدة!» (or «خلّصت A1!»), and «افتح الوحدة n» / «انتقل إلى A2» with «بعدين».
- «دليل الوحدة»: a side sheet (from the bottom on phones) with the level's goal and each lesson of the
  unit with its own goals (from the lesson's objectives), done ones ticked.
- «ارجع لدرسك»: a black pill above the bottom bar while the current lesson is out of sight.
- «ترتيب حر» shows every unit under a heading card; editing shows the whole level with the unit
  stops as black-ringed stops (tap to rename). Reduced motion: no road, hero, burst or sheet motion.

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

**Practice opens in this window** (lesson page): «فلاش كاردز» and «تمارين اختيار» made from a
selection show in it (title: the mark and the practice's name; a 13px muted line «من الجزء اللي
حدّدته · …»; a white sheet inside the dark frame, 15px text, the cards' front 21px), not in a
centred dialog with a backdrop. It opens against the right edge (about 460×620 on an iPad or a
computer; the full width less 8px on a phone), under the circle, which stays reachable. «آخر تدريب»
in the top bar and a new practice bring it back. The book reader still shows practice in its dialog.

**Slide Over (to the right edge).** As on iPad, the window goes off the right edge and comes back:
- *Away:* push it past the right edge (a ghost tab, 50% opacity, appears on the edge; it turns solid
  and grows 8% once letting go would send the window, i.e. when where the flick would carry it puts
  40% of it past the edge); a flick to the right does the same from anywhere; or the bar's » button
  (28px, 44px target, muted, left of the X).
- *Gone:* the window is fully out (shadow too) and inert; a tab stays on the edge, level with where
  the window was: a 24×64 pill with 12px corners, dark glass (rgb(28 28 30 / 0.74), blur 20px,
  saturate 180%), a 0.5px light inner edge and a soft shadow, a white «‹» (17px), in a 44×88 target
  6px in from the edge (away from the browser's own edge swipe). It slides in 14px with a fade
  (220ms, strong ease-out). Solid #1c1c1e with reduced transparency; black with a white edge with
  more contrast.
- *Back:* a tap on the tab (or Enter/Space on it); a pull on the tab to the left (the window follows
  the finger 1:1, with resistance past its place); or, on touch screens, a swipe in from the right
  edge (a 16px strip, only while the window is away; it starts after 8px mostly to the left, and a
  move up or down does nothing). It comes back against the right edge at the same height. A pull
  that shows less than 40% (counting the flick) goes back to the side.
- *Motion:* springs that carry the finger's speed (Apple's terms): away 0.32s / damping 0.86, back
  after a tap 0.40s / 1.0 (no bounce), back after a flick 0.35s / 0.82; a push that does not go
  springs back 0.30s / 1.0. Flicks are projected with Apple's deceleration (0.998). Only transform
  moves, on its own layer. Any motion can be caught: a touch on the window or the tab stops it where
  it is. A pause before letting go is not a flick. No sound for these (they are frequent).
- *Focus:* sent away from the keyboard, focus moves to the tab; back, it moves into the window.
- *Reduced motion:* 160ms fades instead of slides; dragging still follows the finger.
- The work area clips sideways (`overflow-x: clip`), so the page never scrolls sideways.

Type on the study page follows pro tools and the owner's UI research (Nov 2026): 13px for UI text and
12px for small words (top bar, state word, window), 13px for Uzyra's replies (the owner chose smaller
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

## Flashcards from a selection: important words or whole sentences

A selection of more than four words offers two kinds of cards, chosen on a segmented switch at the
top of the practice window: «كلمات مهمة» (each important word or short expression, at most five
words, with its meaning in this text and the bit of text it came from under the meaning) and «جمل
كاملة» (each sentence with its meaning, the original way, now up to 220 characters a side). It
starts on «كلمات مهمة». The switch is a grey 14px-radius track with a blue pill that slides under the
chosen side (transform only, 240ms strong ease-out, none with reduced motion); the chosen side's
text turns white and each side shows how many cards it made. Switching asks for the other kind
once; switching back is instant (the cards are kept for that selection). While cards are made the
window shows what is being picked («بنطلّع الكلمات المهمة…») over three shimmering card shapes.
A word or short phrase is one card either way: no switch. In books, cards now take a whole paragraph
(up to 1500 characters, `canMakeCards`); the other options keep the 600-character limit.

## Saving practice (lessons and books)

Under the cards or questions in the practice window, a quiet grey row «احفظ البطاقات في الفلاش
كاردز» / «احفظ الأسئلة في مختبر المحاضرات» opens a small panel in the same window (`PracticeSave`):
a ticked list of everything made (all ticked; «شيل الكل / اختار الكل»), one muted line saying where
it goes, then «المادة» and «المادة الفرعية» as native 44px selects, each with a blue «+ مادة جديدة» /
«+ فرعية جديدة» that turns into a name field with «أضف» right there. «احفظ N بطاقات/أسئلة» is the one
blue button; «إلغاء» beside it. After saving the row becomes a green line with a check, the place
(«انحفظ 2 بطاقات في "Dracula words / Chapter 1"»), «افتح» and «احفظ بمكان ثاني».

- Questions go to Lecture Lab as one small lecture named after the lesson or book and the start of
  the selection (`lqSaveStudyQuestions`, through `save_lq_generation`; no quota, nothing generated).
  The read-only example shelf is never offered. Each question keeps four options, one right.
- Cards go to the flashcards page's own board (the learning language's), the meaning on the back
  with the note under it; a card whose front is already in that sub-subject is skipped.
- Uzyra's word tray saves flashcards onto the same board (subjects and sub-subjects by name,
  "General" when a whole subject is chosen), so the words show on `/study`. German Lab keeps its
  own subjects on the account. Two copies of the board on one page re-read each other's saves.

Verification: `practice-save.browser.test.ts` (Chromium) saves cards and questions through the
real panel with new subjects, saves the same cards again (nothing doubled), and saves tray words
onto the board.

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

## Uzyra's written sheet (`RitaSheet`)

A long answer is said in one short sentence; the details are written under it as a small white
page in the study guide's style, never read aloud. The model writes them after the line `[[SHEET]]`
(`voice-agent/rita_sheet.py` keeps that part from the voice; `src/lib/rita-sheet.ts` reads it). The
page has an uppercase title over a hairline, a table whose heads are the guide's pills in turn (grey,
green, blue) with a bold first column on #fafafd, points with small blue squares, examples in italics
behind a soft blue rule with the key word bold (an English or German word opens the word window), and
a blue-soft «انتبه / Watch out» card. Each line reads in its own direction (any Arabic: right to
left). 12.5px body, 12px cells, 10px head pills, 13.5px title, radius 16, no shadow; it rises in once (reduced motion: no
movement). A sheet the model wrote badly still shows as plain lines. Short answers have no sheet.

### Explaining a part of Uzyra's answer

A part of one of Uzyra's answers (her words or her sheet) can be selected in the left column. That
selection is dark red (#8E1B2B, white text), never the guide's blue, and stays marked when the browser's
own selection goes. The circle takes a dark red ring, the quote strip a dark red edge with «من جواب
يوزرا», and the wheel's explain slice becomes «اشرحلي ببساطة» (the other slices dim). She
answers that part as to a complete beginner: one very simple sentence and a small sheet. A selection
across two answers, or with the learner's own words, shows «حدّد من رد واحد ليوزرا.» The newest
selection wins: selecting in the guide clears the left one, and the other way round.


## Curriculum editing on the lesson path

**Since Nov 2026:** the path's admin pill is «مصنع الدروس» and opens `/admin/curricula` as a page; a
lesson tapped while editing opens its page in review & publish (`/admin/publish?lesson=`); the
path's + adds exercise stops only (quiz, film & GIF, files, finish), and lessons reach the path by
being published. The side panel below now opens only for an exercise stop's content.

An admin-only “إدارة المحتوى” control on `/rita-lessons` lazy-loads the curriculum workspace.
On wide screens the right-hand panel leaves the learner path visible; below 900px it becomes
one full-width dialog. It reuses the book's Read / Lessons / Review / Publish stages and the
lesson editor's exercises, plan, slides, resources and study-guide tabs. Editors and new-book
forms render inline: never nest their old dialogs inside this panel. The standalone
`/admin/curricula` remains supported through the same components and data hook.

Book preview loads only on demand and renders one PDF page. Coverage comes from each live
lesson's actual page range: published, draft, uncovered, overlaps. Reading progress, lesson
coverage and learner progress are separate concepts. Show at most 100 page buttons at a time.
The path's + can choose an existing or newly-created lesson; placement is explicit, independent
of publication. The server re-reads same-language placements including drafts, checks admin and
level, and saves through the existing atomic layout function. No new database schema is needed.

Protect unsaved edits (including adding goals and rearranging slides), pending uploads and
content generation before navigation. Success refreshes the path and the admin state; failures
remain visible. Archive and publish retain their existing consequences and confirmations.

## Clips library (`/admin/clips`) and the clips player

One clip is one English sentence with its Arabic meaning, one target word (and its meaning), an
optional line about the scene, and a credit. Exercises come only from these fields.

- **Library:** search (English or Arabic, from the start of words), filter chips (الكل · فيديو ·
  GIF · مش بالمسار), cards in 1 / 2 / 3 columns (`minmax(0,1fr)`). Each card: the cover (16:9,
  a «فيديو» or «GIF» tag, tap to preview), the sentence with the target word in `#007bb6`, the
  meaning, «الكلمة: …», the stops that use it as blue chips, the credit line, and تعديل · معاينة ·
  حذف. «اختار» ticks a card; the dark bar fixed to the bottom then offers جرّبها · أضف للمسار ·
  إلغاء. Under the cards, «محطات المقاطع بالمسار» opens a stop's editor.
- **Editor** (the book dialogs' sheet / window): «فيديو من جهازك» or «GIF من GIPHY»; for a video,
  «من هون / لهون» while it plays, the seconds, «جرّب القصّة», and a rights checkbox for a new
  upload; for a GIF, GIPHY search with «Powered by GIPHY». Then the sentence, «اقترح الترجمة
  والكلمة», tappable word chips for the target, the fields, and the credit. Problems show only
  after a save attempt. «شوف كطالب» opens the player on the draft.
- **Stop editor:** the stop's clips in order (↑ ↓ ×) and the library below with + / ✓.
- **Player** (`.film-session`): every clip once, then each clip's exercises. A video: meaning
  (Arabic choices), word order, speaking. A silent GIF: the sentence that fits, then word order
  with the Arabic meaning shown. Answers are 52 px (choices) and 44 px (word tiles) high. Each
  clip shows its credit under the sentence; GIFs add «Powered by GIPHY». A GIF loops muted.
- Videos are cut by seeking to the start and pausing at the end; nothing is re-encoded.

