# Family Kitchen · Design Blueprint

Prepared 27 September 2026. **Implemented the same day** with Peter's choices:

- Set A: Fraunces and Source Sans 3, self-hosted, with a Fraunces italic subset for the splash.
- Baltic for summer.
- Seasons follow the calendar automatically (spring from 1 March, summer from 1 June, autumn from 1 September, winter from 1 December). A Settings picker can keep one season all year.
- Android's status bar matches the page background of the current season and theme.
- A new `--border-field` token gives form fields a visible 3:1 edge.

The Autumn palette and Appendix A are now the live tokens in `src/index.css`.

This blueprint covers two things:

1. **Typography.** Four new font sets to replace Playfair Display and Plus Jakarta Sans, with a recommendation and a type scale.
2. **Colour.** Today's light and dark palettes become **Autumn**, joined by **Winter**, **Spring** and **Summer**, each with a light and a dark version. How and when the app moves between seasons is deliberately out of scope.

The brief: professional, elegant and modern, used mostly on phones by young adults and older relatives alike.

## Summary

- **Recommended fonts: Set A "Hearth".** _Fraunces_ for headings, _Source Sans 3_ for everything else, with reading text raised to 18px. It keeps the heirloom warmth the family already knows and fixes the two legibility problems in the current fonts.
- **Seasonal palettes:** Autumn _Heirloom Hearth_ (today's colours, unchanged), Winter _Porcelain & Cobalt_, Spring _Dill & Butter_ and Summer _Baltic_, with _Lavender & Linden Honey_ as an alternative summer.
- **Readability never changes with the season.** Every seasonal colour has the same luminance as its autumn counterpart, so every text/background pair keeps the contrast the family is used to. All text passes WCAG AA in every season and mode, and the seasonal accents are slightly stronger than autumn's.
- **Found along the way (live today):**
  1. Plus Jakarta Sans draws capital **I** and lowercase **l** as identical bars, so a Polish ingredient such as "1 l mleka" (1 litre of milk) is easy to misread.
  2. The fractions ⅓ ⅔ ⅛ ⅜ ⅝ ⅞ in ingredient amounts render in the phone's fallback font rather than the app's font, because Google Fonts' standard subsets don't include them. ½ ¼ ¾ are fine. _Fixed on 27 September 2026, first with a bundled subset of Plus Jakarta Sans, then by self-hosting Source Sans 3 with the fraction block._
  3. Form-field borders are 1.5:1 against their fill, where the WCAG guideline for input edges is 3:1. _Fixed with `--border-field` (3.26–3.28:1 in every palette; see §3.9)._

## 1. Guiding principles

- **Professional, elegant, modern.** Two typefaces, one token system, generous space and restrained colour. Elegance comes from consistency, not decoration.
- **Readable at kitchen distance.** The phone is often propped on the counter at arm's length and glanced at with busy hands. Reading text must be larger and sturdier than in a typical app, and numbers must be unambiguous.
- **Designed for older eyes, pleasant for young ones.** With age, close focus gets harder, contrast sensitivity drops, and the eye's lens yellows, so blues and violets look darker and greyer. That means high contrast without pure-white or pure-black glare (the current cream and near-black already do this), no hairline strokes, no meaning carried by colour alone, and no small italics.
- **Bilingual by default.** Polish diacritics (ą ć ę ł ń ó ś ź ż) must be first-class. Polish strings in this app run 50–80% longer than English ("Cook Mode: Off" becomes "Tryb gotowania: Wyłączony"), so narrower text faces earn their place.
- **Food first.** Recipe photos are the hero. Backgrounds stay near-neutral so food looks true, and colour lives in the accents.
- **One identity, four seasons.** Whatever the season, the app must still feel like Family Kitchen.

## 2. Typography

### 2.1 Where the current fonts fall short

| Area                | Today             | Issue                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headings            | Playfair Display  | A high-contrast display serif with very fine hairlines and ball terminals. Beautiful at 32px and up, but fragile at card-title and section sizes (21–26px), on lower-resolution screens, and in dark mode, where fine light strokes break up.                                                                                 |
| Reading text and UI | Plus Jakarta Sans | Modern and clean, but **I** and **l** are identical bars and **1** is close to both, as in "1 l mleka".                                                                                                                                                                                                                       |
| Sizes               | n/a               | Method steps are 15.6px, ingredients 15.2px, card text 14px, and several labels 10.5–11px (0.66–0.7rem). That's small for arm's-length reading.                                                                                                                                                                               |
| Fractions           | n/a               | `formatFraction()` outputs Unicode ½ ¼ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞. Google's `latin` and `latin-ext` subsets stop short of U+2150–215F, so ⅓ ⅔ ⅛ ⅜ ⅝ ⅞ fall back to the system font even though Plus Jakarta Sans contains them. Verified in Chrome with the live stylesheet. _Fixed 27 Sep 2026: a bundled 2 KB subset now supplies them._ |
| Italics             | n/a               | Ingredient notes are set in italic, but no italic is loaded, so the browser slants the upright font instead.                                                                                                                                                                                                                  |

### 2.2 How the sets were chosen

- **Google Fonts only.** The app already loads its fonts from Google Fonts and `sw.js` caches them, so none of these adds a new third-party service. All of them are open source (SIL Open Font License).
- **Measured, not eyeballed.** 72 families (38 sans, 34 serif) were loaded in Chrome 154 and measured for x-height, width, whether **I l 1** can be told apart, Polish coverage, whether the nine fraction glyphs exist in the font _and_ are actually delivered, and tabular figures. See [Appendix C](#appendix-c--font-measurements).
- **Tested on the real screens.** The finalists were rendered on the vault and recipe screens using the app's own `index.css` and Wanda's recipe in English and Polish, at phone width, in light and dark.

What a reading face must do here:

1. Tell **I**, **l** and **1** apart clearly, with a tailed **l** or a serifed **I**.
2. Have open, sturdy shapes, a healthy x-height and no fine hairlines.
3. Contain all nine recipe fractions.
4. Support Polish well, with well-drawn diacritics.
5. Offer variable weights, so body text can be 450 in light mode and 400 in dark.
6. Stay moderately narrow, so long Polish words still fit at larger sizes.

Heading faces were judged on character, sturdiness at 20–32px, Polish diacritics, and width. The Polish vault title, "Skarbiec Przepisów Rodzinnych", is long.

### 2.3 The four sets at a glance

| Set                          | Headings         | Reading text and UI        | Feel                        | I · l · 1 distinct | All 9 fractions      | Download |
| ---------------------------- | ---------------- | -------------------------- | --------------------------- | ------------------ | -------------------- | -------- |
| Today                        | Playfair Display | Plus Jakarta Sans          | Elegant, editorial          | No                 | Yes (bundled subset) | 141 KB   |
| **A · Hearth** (recommended) | Fraunces         | Source Sans 3              | Warm, crafted, cookbook     | Yes                | Yes                  | 210 KB   |
| B · Editorial                | Newsreader       | Public Sans                | Crisp, food magazine        | Yes                | Yes                  | 258 KB   |
| C · Clarity                  | Literata         | Atkinson Hyperlegible Next | Bookish, maximum legibility | Yes, strongest     | No (½ ¼ ¾ only)      | 205 KB   |
| D · Heritage                 | Brygada 1918     | Signika                    | Polish heritage             | Yes                | Yes                  | 160 KB   |

Downloads cover Latin and Polish in upright weights, measured against Google Fonts. The cost is paid once, then the fonts are cached.

#### Set A · Hearth: Fraunces and Source Sans 3 (recommended)

- **Headings: Fraunces.** A soft "Old Style" serif by Undercase Type (Phaedra Charles and Flavia Zimbardi), inspired by early 20th-century faces such as Windsor, Souvenir and Cooper. Its optical sizing automatically makes it sturdier at card-title sizes and finer at hero sizes. Warm and confident with no fragile hairlines: an heirloom feel, drawn this decade.
- **Reading text and UI: Source Sans 3.** Adobe's first open-source family, designed by Paul D. Hunt for interfaces. It's humanist and calm, with open shapes, a tailed **l**, a flagged and footed **1**, and an oval zero. It has all nine fractions, excellent Polish, and tabular figures by default, so amounts line up.
- **Why it wins.** It fixes both legibility problems without losing the heirloom character. It's also narrow: at 18px, Source Sans 3 sets the same line length as Plus Jakarta Sans at 16px. That means bigger letters, the same words per line, and room for long Polish words.
- **Trade-offs.** Source Sans 3 has a moderate x-height, so reading text needs to be 18px (as in the scale below). Fraunces has a lot of character, so it stays in headings only.
- **Settings.** Headings in Fraunces at weight 600–650 with −0.01em tracking. Reading text in Source Sans 3 at 1.125rem, weight 450 (400 in dark mode), with labels and buttons at 600–700. Load only Fraunces's weight and optical-size axes. Its extra _Softness_ and _Wonky_ axes nearly double the download (124 KB to 221 KB) for a difference no one will notice on a phone.
- **Splash.** "Welcome to" in Fraunces italic is lovely, for a one-time 78 KB. Upright Fraunces in the accent colour works too.

#### Set B · Editorial: Newsreader and Public Sans

- **Headings: Newsreader** by Production Type, designed for continuous on-screen reading, with optical sizes. Crisp, sharp and magazine-like.
- **Reading text and UI: Public Sans**, the US Web Design System's neutral interface face, based on Libre Franklin. It has a tailed **l**, all nine fractions and a large x-height, so 17px is enough.
- **Choose it if** you want the most "polished publication" look.
- **Trade-offs.** Newsreader looks thin below weight 600, so headings must stay heavy. It's the heaviest download at 258 KB. Public Sans is wide, so Polish lines wrap sooner; "½ cup crushed" wrapped at 17px in the mock.

#### Set C · Clarity: Literata and Atkinson Hyperlegible Next

- **Headings: Literata** by TypeTogether, created as the typeface for Google Play Books and winner of a Gold Indigo Award in 2021. Robust, bookish and very readable.
- **Reading text and UI: Atkinson Hyperlegible Next.** Named after the founder of the Braille Institute and developed to increase legibility for readers with low vision. It has a serifed **I**, a tailed **l**, a footed **1** and a slashed zero: the most unambiguous letterforms of any set.
- **Choose it if** the older relatives' comfort outweighs everything else.
- **Trade-offs.** It lacks ⅓ ⅔ ⅛ ⅜ ⅝ ⅞, so those amounts would have to be built from plain digits with the font's fraction feature. The unused `.fraction` class already does this, but it's a code change. The slashed zero looks technical in "450 g" and in the step 0 badge, where it reads like "ø". It's the least elegant set.

#### Set D · Heritage: Brygada 1918 and Signika

- **Headings: Brygada 1918.** Revived for the centenary of Poland's independence in 2018 by a Polish team (Capitalics: Mateusz Machalski, Borys Kosmynka, Ania Wieluńska and Przemysław Hoffer). It's based on the National Type Foundry's 1954 catalogue and on matrices rediscovered at the Book Arts Museum in 2016.
- **Reading text and UI: Signika** by Anna Giedryś, who trained at the University of Fine Arts in Poznań. It was designed for wayfinding, with a tall x-height and low contrast so text reads "in small sizes as well as in large distances". A kitchen counter is exactly that. It has a tailed **l**, all nine fractions, tabular figures, and a _grade_ axis that thins text slightly in dark mode without reflowing it.
- **Choose it if** you want the family story in the type itself: a Polish-designed pairing for a Polish-English kitchen. It's also the lightest download.
- **Trade-offs.** Brygada has only four weights and no optical sizes, which is fine for headings. Signika feels sturdy and signage-like, less refined than Source Sans 3.

### 2.4 Recommendation

**Set A, Fraunces and Source Sans 3.** It's the best balance of the brief:

- **Elegant and modern:** a serif with real warmth, and a sans that looks designed rather than default.
- **Legible:** distinct **I l 1**, open shapes, a larger reading size, sturdy headings and every fraction in the font.
- **Bilingual:** first-class Polish, and narrow enough for long Polish strings at larger sizes.
- **Familiar:** the family keeps the heirloom feel they know, only clearer.

The sets share one role system, so faces can be mixed. Fraunces with Atkinson Hyperlegible Next is a good option if Clarity's letterforms matter more than the fractions. Brygada 1918 with Source Sans 3 keeps the heritage story with the smoother reading face.

### 2.5 Type scale (for any set)

Sizes stay in `rem`, so the app's text-size setting keeps working. Values are for Set A. Set B's reading size is 1.0625rem (17px) because of its larger x-height.

| Role               | Where                                        | Today                  | Proposed                                  |
| ------------------ | -------------------------------------------- | ---------------------- | ----------------------------------------- |
| Page title         | `.vault-hero h1`                             | 1.8rem on phones       | 2rem, heading face 600–650                |
| Recipe title       | `.detail-title`                              | clamp(2rem, 5vw, 3rem) | Unchanged                                 |
| Card title         | `.card-title`                                | 1.35rem, 700           | 1.375rem, 600–650                         |
| Section title      | `.panel-title`, `.section-heading`           | 1.35rem and 1.6rem     | 1.5rem for both                           |
| Method steps       | `.step-text`                                 | 0.975rem               | **1.125rem**, weight 450, line-height 1.6 |
| Ingredients        | `.ingredient-name`, `.ingredient-amount-col` | 0.95rem, 600           | **1.125rem**, 600                         |
| Ingredient notes   | `.ingredient-bracket-note`                   | 0.825rem, italic       | 0.875rem, upright, 500                    |
| Kitchen tip, notes | `.callout-box`, `.step-note-pill`            | 0.925rem and 0.85rem   | 1.0625rem and 0.9375rem                   |
| Card description   | `.card-desc`                                 | 0.875rem               | 0.9375rem                                 |
| Author and time    | `.card-meta`, `.detail-meta`                 | 0.825rem and 0.95rem   | 0.875rem and 1rem                         |
| Buttons, tabs      | `.btn`, `.filter-tab`                        | 0.875rem and 0.85rem   | 0.9375rem, 600                            |
| Uppercase labels   | Table headers, badges, chips, menu eyebrows  | 0.66–0.75rem           | **0.75rem minimum**, 700, +0.06–0.08em    |

House rules:

- **Minimum sizes.** Nothing below 0.75rem (12px), and that only for short uppercase labels. Everything else is at least 0.8125rem (13px).
- **No italics below 16px.** Use weight or colour for emphasis instead.
- **Dark mode.** Drop the reading weight by about 50 (450 to 400) to offset light-on-dark bloom. In Set D, use Signika's grade axis instead.
- **Spacing.** Headings get −0.01em tracking and a line-height of 1.1–1.2. Body text stays at 1.6.
- **Figures.** Keep tabular figures in amounts and times.

### 2.6 Notes for when the fonts change

These are not a plan, just things that must be true:

- **Fractions must come from the chosen font.** Google's standard subsets omit U+2150–215F. Self-hosting the fonts, with a subset covering Latin, Polish and the fraction block, fixes that. It also removes the Google request, works offline from the very first visit, and gets cached by `sw.js`.
- **Request only what's used.** Load only the weight and optical-size axes, with heading weights 500–700 and reading weights 400–700.
- **Keep fallbacks.** Keep `font-display: swap` and close fallbacks (Georgia for headings, `system-ui` for text) to limit layout shift.

## 3. Colour: seasonal palettes

### 3.1 Principles

- **Autumn is today's palette, unchanged.** It's also the reference every other season is built from.
- **Same tokens in every season.** Each season defines exactly the variables that `src/index.css` defines today (`--bg-*`, `--text-*`, `--border-*`, `--accent*`, `--accent-gold*`, `--menu-*`, the shadows and the scrim), so no component needs to know which season it is.
- **Luminance-locked.** Each seasonal colour was built in OKLCH with the WCAG luminance of its autumn twin; only hue and saturation move. Every text/background pair therefore keeps its contrast ratio to within 0.1 (rounding), and the visual weight of the app never shifts. Accents may go darker in light mode or lighter in dark mode, since that only adds contrast, but never below autumn.
- **Appetite-safe backgrounds.** Backgrounds stay close to neutral, with only a whisper of hue. Cool colours live in the accents, so food photos stay true in every season.
- **Restraint.** Saturation matches autumn's: heirloom, not candy.
- **The gold thread.** `--accent-gold` stays gold all year: honey, candlelight, butter, amber. Cook Mode, the Kitchen Tip and draft badges keep their meaning, and every season stays tied to the gold in the family emblem.
- **Meaning never moves.** The Crucial Note and Delete reds, the success green and the photo overlays are identical all year. No season uses red or orange as its accent, so a primary button can never be mistaken for a warning.
- **The crest stays.** The emblem and app icon keep their terracotta and gold in every season; the home-screen icon can't change anyway. Each season's accent was chosen to sit well beside terracotta:
  - cobalt is its complement
  - herb green is a terracotta pot of herbs
  - sea teal is Mediterranean tile
  - lavender grows in terracotta pots

### 3.2 The year at a glance

| Season          | Name                    | Accent (light)       | Gold                   | Background (light)              | Accent (dark) | Background (dark)   |
| --------------- | ----------------------- | -------------------- | ---------------------- | ------------------------------- | ------------- | ------------------- |
| Autumn · Jesień | Heirloom Hearth (today) | `#ad4f2d` terracotta | `#8a5d06` honey        | `#fbf9f5` / `#f5f0e6` cream     | `#e06d48`     | `#161311` espresso  |
| Winter · Zima   | Porcelain & Cobalt      | `#3b5dab` cobalt     | `#855f0f` candlelight  | `#f8f9fb` / `#edf1f5` porcelain | `#7394da`     | `#121417` midnight  |
| Spring · Wiosna | Dill & Butter           | `#327243` herb green | `#836000` butter       | `#faf9f6` / `#f2f1e8` linen     | `#59a16a`     | `#121412` moss      |
| Summer · Lato   | Baltic                  | `#007384` sea teal   | `#915905` amber        | `#f7fafa` / `#ebf2f2` sea salt  | `#279da8`     | `#101416` night sea |
| Summer (alt.)   | Lavender & Linden Honey | `#7b53a5` lavender   | `#8a5d05` linden honey | `#fbf9f6` / `#f5f0e9` linen     | `#a886cf`     | `#141316` dusk      |

The light background column is `--bg-main` / `--bg-card`; the dark one is `--bg-main`.

### 3.3 Autumn · Heirloom Hearth (today)

Harvest, bread and the hearth: terracotta and honey on cream, espresso at night. It's a textbook autumn palette (warm, deep and muted), and it stays exactly as it is.

### 3.4 Winter · Porcelain & Cobalt

Inspired by Polish stoneware from Bolesławiec (cobalt on white), frost, and candlelight at Wigilia.

- **Accent.** A deep, inky cobalt, `#3b5dab`. It's deeper than autumn's luminance, so links, buttons and step numbers gain contrast: 6.3:1 against white versus 5.3:1.
- **Background.** Porcelain white with only a whisper of cool (`#f8f9fb`), kept near-neutral so food doesn't look cold. Shadows turn a cool blue-grey.
- **Gold.** Becomes candlelight brass, the one warm note against the cobalt.
- **Dark ("Midnight").** A blue-slate night with frost-white text and a periwinkle-cobalt accent.

### 3.5 Spring · Dill & Butter

_Nowalijki_, the first vegetables of spring: new potatoes with butter and dill. Easter, too.

- **Accent.** A grown-up herb green, `#327243`: garden, not traffic light.
- **Background.** Fresh linen with a faint green-gold breath (`#faf9f6`).
- **Gold.** Becomes butter.
- **Dark ("Moss").** Forest-floor greens with a fresh-leaf accent.

### 3.6 Summer · Baltic (and an alternative)

Summer holidays _nad morzem_: sea glass and Baltic amber (_bursztyn_).

- **Accent.** A clear sea teal, `#007384`.
- **Background.** Sea-salt white with the faintest aqua (`#f7fafa`).
- **Gold.** Becomes amber, keeping the season warm.
- **Dark ("Night sea").** A deep teal-navy with a bright sea-glass accent.

**Alternative: Lavender & Linden Honey.** Lavender and July's linden honey (_miód lipowy_), with a lavender accent (`#7b53a5`) on warm linen. Choose it for a bigger visual change from spring's green. Teal is the recommendation because it reads as summer to everyone, holds its colour better for older eyes (violet greys out with age), and is closer to home. The alternative's backgrounds sit very close to autumn's, so its accent carries most of the change.

### 3.7 What stays the same in every season

- **Status colours:** the Crucial Note and warning reds, Delete, the danger badge, and `--success` / `--success-subtle` (currently unused).
- **Photo overlays:** scrims over images in the image viewer, card badges and zoom hints.
- **Brand:** the splash emblem colours (`--fk-emblem-*`) and their glow, the app icon, the favicon, and Google's own sign-in button colours.

The splash screen's "Welcome to" line uses `--accent`, so it will take on each season's accent beside the heritage emblem.

### 3.8 Contrast, verified

Every colour pair the stylesheet actually uses was checked in all ten palettes (five palettes, each light and dark). The full table is in [Appendix B](#appendix-b--contrast-verification).

- **Every text pair passes WCAG AA (4.5:1) in every season and mode.** The tightest pair is small accent text on its tint (step numbers, chips): 4.54:1 in autumn light today, and 4.73–5.35:1 in the new seasons' light modes.
- **Body text stays at 15–17.5:1** (AAA) all year.
- **Only two pairs fall short, identically in every season:** the form-field edge and the dashed-border edge (see below).

### 3.9 Observations on today's palette

- **Form fields are hard to find.** `--border-strong` against the field fill is 1.49:1 in light mode and 1.80:1 in dark. WCAG 1.4.11 asks for 3:1 at the edge of a text field, and the older relatives are the ones who'll struggle to see where to type. _Fixed:_ a dedicated `--border-field` token at 1.5px, computed per palette at 3:1 against both the field fill and the surface.
- **Colours outside the token system,** which no season would change:
  - the `rgba(200, 90, 50, 0.1)` tint on the not-family screen (`AuthGate.tsx`)
  - `<meta name="theme-color">` and the manifest's `theme_color` / `background_color` (`#ad4f2d` / `#fbf9f5`), which colour Android's status bar and install splash
  - the danger and warning reds, deliberately

  _Since implemented:_ the tint is now `--accent-subtle`. `theme-color` follows the season and theme at runtime (`hooks/useSeason`). Each build writes the season's page colour into the manifest, and `deploy.yml` rebuilds on the first day of every season. The reds stay fixed.

### 3.10 Out of scope

How and when the app moves between seasons is deliberately left out. The palettes are designed so any season can follow any other, and so a change of season never changes readability.

## Appendix A · Token reference

All values are computed, not hand-picked. The `a` in the shadow tints keeps today's alphas: 0.06 / 0.1 / 0.16 in light mode and 0.35 / 0.5 / 0.6 in dark.

### Autumn · Heirloom Hearth (today)

| Token                      | Light                     | Dark                       |
| -------------------------- | ------------------------- | -------------------------- |
| `--bg-main`                | `#fbf9f5`                 | `#161311`                  |
| `--bg-surface`             | `#ffffff`                 | `#211b17`                  |
| `--bg-card`                | `#f5f0e6`                 | `#2b231e`                  |
| `--bg-card-hover`          | `#ede6d8`                 | `#362d27`                  |
| `--border-subtle`          | `#e7dec8`                 | `#3d312a`                  |
| `--border-strong`          | `#dcc1b9`                 | `#5a493e`                  |
| `--text-primary`           | `#1c1917`                 | `#f8f1e9`                  |
| `--text-secondary`         | `#56423d`                 | `#d8cdc3`                  |
| `--text-muted`             | `#6f6862`                 | `#a8988c`                  |
| `--accent`                 | `#ad4f2d`                 | `#e06d48`                  |
| `--accent-hover`           | `#963f22`                 | `#e87a56`                  |
| `--accent-subtle`          | `#fbe9e2`                 | `#3a2219`                  |
| `--on-accent`              | `#ffffff`                 | `#181412`                  |
| `--accent-gold`            | `#8a5d06`                 | `#f2ba49`                  |
| `--accent-gold-subtle`     | `#fcf1dc`                 | `#2e2415`                  |
| `--success`                | `#2d4a3e`                 | `#aecebd`                  |
| `--success-subtle`         | `#e6efe9`                 | `#1c2a24`                  |
| `--elev-menu`              | `#ffffff`                 | `#2b231e`                  |
| `--menu-well`              | `#f5f0e6`                 | `#362d27`                  |
| `--menu-well-hover`        | `#ede6d8`                 | `#43382f`                  |
| `--scrim`                  | `rgba(28, 25, 23, 0.28)`  | `rgba(10, 7, 5, 0.55)`     |
| Shadow tint (`--shadow-*`) | `rgba(60, 35, 20, a)`     | `rgba(8, 5, 3, a)`         |
| `--fab-shadow` tint        | `rgba(173, 79, 45, 0.45)` | `rgba(224, 109, 72, 0.32)` |

### Winter · Porcelain & Cobalt

| Token                      | Light                     | Dark                        |
| -------------------------- | ------------------------- | --------------------------- |
| `--bg-main`                | `#f8f9fb`                 | `#121417`                   |
| `--bg-surface`             | `#ffffff`                 | `#191c23`                   |
| `--bg-card`                | `#edf1f5`                 | `#20252d`                   |
| `--bg-card-hover`          | `#e2e7ed`                 | `#2a2f38`                   |
| `--border-subtle`          | `#d8dfe8`                 | `#2d3440`                   |
| `--border-strong`          | `#bec7d7`                 | `#434d5e`                   |
| `--text-primary`           | `#161a20`                 | `#eef3f8`                   |
| `--text-secondary`         | `#3c475a`                 | `#c7d0db`                   |
| `--text-muted`             | `#646a71`                 | `#919cab`                   |
| `--accent`                 | `#3b5dab`                 | `#7394da`                   |
| `--accent-hover`           | `#2c4d99`                 | `#7d9fe5`                   |
| `--accent-subtle`          | `#e6edfa`                 | `#1d283e`                   |
| `--on-accent`              | `#ffffff`                 | `#131519`                   |
| `--accent-gold`            | `#855f0f`                 | `#ebbc5a`                   |
| `--accent-gold-subtle`     | `#faf1de`                 | `#2d2417`                   |
| `--success`                | `#2d4a3e`                 | `#aecebd`                   |
| `--success-subtle`         | `#e6efe9`                 | `#1c2a24`                   |
| `--elev-menu`              | `#ffffff`                 | `#20252d`                   |
| `--menu-well`              | `#edf1f5`                 | `#2a2f38`                   |
| `--menu-well-hover`        | `#e2e7ed`                 | `#333a47`                   |
| `--scrim`                  | `rgba(22, 26, 32, 0.28)`  | `rgba(6, 8, 11, 0.55)`      |
| Shadow tint (`--shadow-*`) | `rgba(30, 42, 59, a)`     | `rgba(4, 6, 9, a)`          |
| `--fab-shadow` tint        | `rgba(59, 93, 171, 0.45)` | `rgba(115, 148, 218, 0.32)` |

### Spring · Dill & Butter

| Token                      | Light                     | Dark                       |
| -------------------------- | ------------------------- | -------------------------- |
| `--bg-main`                | `#faf9f6`                 | `#121412`                  |
| `--bg-surface`             | `#ffffff`                 | `#181d19`                  |
| `--bg-card`                | `#f2f1e8`                 | `#1f2621`                  |
| `--bg-card-hover`          | `#e9e7db`                 | `#29312a`                  |
| `--border-subtle`          | `#e2dfcd`                 | `#2c362d`                  |
| `--border-strong`          | `#bbcbbb`                 | `#415044`                  |
| `--text-primary`           | `#151b16`                 | `#f3f2eb`                  |
| `--text-secondary`         | `#394b3c`                 | `#ced0c4`                  |
| `--text-muted`             | `#686a62`                 | `#949e90`                  |
| `--accent`                 | `#327243`                 | `#59a16a`                  |
| `--accent-hover`           | `#1f6133`                 | `#63ac74`                  |
| `--accent-subtle`          | `#e2f0e2`                 | `#182d1c`                  |
| `--on-accent`              | `#ffffff`                 | `#121613`                  |
| `--accent-gold`            | `#836000`                 | `#e5bf50`                  |
| `--accent-gold-subtle`     | `#f9f2dc`                 | `#2b2516`                  |
| `--success`                | `#2d4a3e`                 | `#aecebd`                  |
| `--success-subtle`         | `#e6efe9`                 | `#1c2a24`                  |
| `--elev-menu`              | `#ffffff`                 | `#1f2621`                  |
| `--menu-well`              | `#f2f1e8`                 | `#29312a`                  |
| `--menu-well-hover`        | `#e9e7db`                 | `#323d34`                  |
| `--scrim`                  | `rgba(21, 27, 22, 0.28)`  | `rgba(6, 8, 6, 0.55)`      |
| Shadow tint (`--shadow-*`) | `rgba(30, 45, 27, a)`     | `rgba(4, 6, 4, a)`         |
| `--fab-shadow` tint        | `rgba(50, 114, 67, 0.45)` | `rgba(89, 161, 106, 0.32)` |

### Summer · Baltic

| Token                      | Light                     | Dark                       |
| -------------------------- | ------------------------- | -------------------------- |
| `--bg-main`                | `#f7fafa`                 | `#101416`                  |
| `--bg-surface`             | `#ffffff`                 | `#151e21`                  |
| `--bg-card`                | `#ebf2f2`                 | `#1b262a`                  |
| `--bg-card-hover`          | `#dee9e9`                 | `#243135`                  |
| `--border-subtle`          | `#d2e2e2`                 | `#25363c`                  |
| `--border-strong`          | `#b2cbd0`                 | `#375059`                  |
| `--text-primary`           | `#121b1e`                 | `#f4f2ec`                  |
| `--text-secondary`         | `#304b52`                 | `#c4d1d2`                  |
| `--text-muted`             | `#616b6d`                 | `#8b9ea2`                  |
| `--accent`                 | `#007384`                 | `#279da8`                  |
| `--accent-hover`           | `#00616f`                 | `#36a7b3`                  |
| `--accent-subtle`          | `#dbf1f3`                 | `#092c32`                  |
| `--on-accent`              | `#ffffff`                 | `#101618`                  |
| `--accent-gold`            | `#915905`                 | `#fab64e`                  |
| `--accent-gold-subtle`     | `#fdf1dc`                 | `#2e2417`                  |
| `--success`                | `#2d4a3e`                 | `#aecebd`                  |
| `--success-subtle`         | `#e6efe9`                 | `#1c2a24`                  |
| `--elev-menu`              | `#ffffff`                 | `#1b262a`                  |
| `--menu-well`              | `#ebf2f2`                 | `#243135`                  |
| `--menu-well-hover`        | `#dee9e9`                 | `#2b3d43`                  |
| `--scrim`                  | `rgba(18, 27, 30, 0.28)`  | `rgba(4, 8, 10, 0.55)`     |
| Shadow tint (`--shadow-*`) | `rgba(14, 45, 56, a)`     | `rgba(3, 6, 8, a)`         |
| `--fab-shadow` tint        | `rgba(0, 115, 132, 0.45)` | `rgba(39, 157, 168, 0.32)` |

### Summer alternative · Lavender & Linden Honey

| Token                      | Light                      | Dark                        |
| -------------------------- | -------------------------- | --------------------------- |
| `--bg-main`                | `#fbf9f6`                  | `#141316`                   |
| `--bg-surface`             | `#ffffff`                  | `#1d1b21`                   |
| `--bg-card`                | `#f5f0e9`                  | `#26232b`                   |
| `--bg-card-hover`          | `#ede6dc`                  | `#302d37`                   |
| `--border-subtle`          | `#e8ddce`                  | `#35323d`                   |
| `--border-strong`          | `#cbc4d6`                  | `#4f4a5b`                   |
| `--text-primary`           | `#1b191f`                  | `#f5f2eb`                   |
| `--text-secondary`         | `#4c4356`                  | `#d0cdd7`                   |
| `--text-muted`             | `#6a686f`                  | `#9d99a8`                   |
| `--accent`                 | `#7b53a5`                  | `#a886cf`                   |
| `--accent-hover`           | `#6b4293`                  | `#b391da`                   |
| `--accent-subtle`          | `#f0eaf9`                  | `#2e2439`                   |
| `--on-accent`              | `#ffffff`                  | `#151418`                   |
| `--accent-gold`            | `#8a5d05`                  | `#f4b94a`                   |
| `--accent-gold-subtle`     | `#fcf1dc`                  | `#2d2417`                   |
| `--success`                | `#2d4a3e`                  | `#aecebd`                   |
| `--success-subtle`         | `#e6efe9`                  | `#1c2a24`                   |
| `--elev-menu`              | `#ffffff`                  | `#26232b`                   |
| `--menu-well`              | `#f5f0e9`                  | `#302d37`                   |
| `--menu-well-hover`        | `#ede6dc`                  | `#3c3844`                   |
| `--scrim`                  | `rgba(27, 25, 31, 0.28)`   | `rgba(8, 7, 10, 0.55)`      |
| Shadow tint (`--shadow-*`) | `rgba(45, 38, 57, a)`      | `rgba(6, 5, 9, a)`          |
| `--fab-shadow` tint        | `rgba(123, 83, 165, 0.45)` | `rgba(168, 134, 207, 0.32)` |

## Appendix B · Contrast verification

WCAG 2 contrast ratios for every foreground/background pair the stylesheet uses. "Needs" is 4.5 for text and 3 for large or bold text and interface edges. Values below the bar are in bold.

**Light mode**

| Where it's used                        | Needs | Autumn   | Winter   | Spring   | Summer   | Summer alt. |
| -------------------------------------- | ----- | -------- | -------- | -------- | -------- | ----------- |
| Body text on the page                  | 4.5   | 16.63    | 16.57    | 16.62    | 16.66    | 16.58       |
| Body text on cards and panels          | 4.5   | 17.49    | 17.46    | 17.50    | 17.48    | 17.42       |
| Text on wells and table headers        | 4.5   | 15.40    | 15.38    | 15.43    | 15.41    | 15.37       |
| Text on hovered rows and menu wells    | 4.5   | 14.08    | 14.04    | 14.10    | 14.10    | 14.06       |
| Restore banner, install card           | 4.5   | 14.87    | 14.85    | 14.83    | 14.89    | 14.80       |
| Step note pill                         | 4.5   | 15.62    | 15.55    | 15.63    | 15.64    | 15.56       |
| Vault intro text                       | 4.5   | 8.91     | 8.90     | 8.88     | 8.88     | 8.90        |
| Card description, filter tabs          | 4.5   | 9.37     | 9.37     | 9.35     | 9.32     | 9.36        |
| Table headers, photo captions          | 4.5   | 8.25     | 8.26     | 8.25     | 8.21     | 8.25        |
| Card meta, dates                       | 4.5   | 5.48     | 5.47     | 5.49     | 5.48     | 5.49        |
| Empty vault message                    | 4.5   | 5.21     | 5.19     | 5.21     | 5.22     | 5.23        |
| Segmented labels on wells              | 4.5   | 4.82     | 4.82     | 4.84     | 4.83     | 4.85        |
| Links, cook time, card footer          | 4.5   | 5.34     | 6.29     | 5.80     | 5.55     | 5.80        |
| Splash "Welcome to"                    | 4.5   | 5.08     | 5.97     | 5.50     | 5.29     | 5.52        |
| Callout labels                         | 4.5   | 4.70     | 5.54     | 5.11     | 4.89     | 5.11        |
| Step numbers, chips, current menu item | 4.5   | 4.54     | 5.35     | 4.91     | 4.73     | 4.92        |
| Primary buttons, menu button           | 4.5   | 5.34     | 6.29     | 5.80     | 5.55     | 5.80        |
| Primary button hover                   | 4.5   | 6.93     | 7.99     | 7.46     | 7.14     | 7.43        |
| Cook Mode banner, drafts, tip label    | 4.5   | 5.14     | 5.14     | 5.16     | 5.17     | 5.14        |
| Theme switch sun icon                  | 3     | 5.75     | 5.77     | 5.77     | 5.78     | 5.76        |
| Active filter tab, toast               | 4.5   | 17.49    | 17.46    | 17.50    | 17.48    | 17.42       |
| Form field edge (WCAG 1.4.11)          | 3     | **1.49** | **1.50** | **1.50** | **1.50** | **1.49**    |
| Dashed empty-state and add-step edge   | 3     | **1.70** | **1.70** | **1.70** | **1.70** | **1.69**    |

**Dark mode**

| Where it's used                        | Needs | Autumn   | Winter   | Spring   | Summer   | Summer alt. |
| -------------------------------------- | ----- | -------- | -------- | -------- | -------- | ----------- |
| Body text on the page                  | 4.5   | 16.51    | 16.53    | 16.49    | 16.55    | 16.56       |
| Body text on cards and panels          | 4.5   | 15.20    | 15.27    | 15.23    | 15.13    | 15.26       |
| Text on wells and table headers        | 4.5   | 13.77    | 13.79    | 13.78    | 13.82    | 13.83       |
| Text on hovered rows and menu wells    | 4.5   | 12.01    | 12.04    | 11.94    | 11.98    | 12.07       |
| Restore banner, install card           | 4.5   | 13.18    | 13.20    | 13.08    | 13.23    | 13.16       |
| Step note pill                         | 4.5   | 13.59    | 13.67    | 13.57    | 13.58    | 13.65       |
| Vault intro text                       | 4.5   | 11.84    | 11.84    | 11.85    | 11.82    | 11.81       |
| Card description, filter tabs          | 4.5   | 10.89    | 10.94    | 10.94    | 10.81    | 10.88       |
| Table headers, photo captions          | 4.5   | 9.87     | 9.88     | 9.90     | 9.87     | 9.87        |
| Card meta, dates                       | 4.5   | 6.11     | 6.13     | 6.15     | 6.06     | 6.14        |
| Empty vault message                    | 4.5   | 6.64     | 6.63     | 6.66     | 6.62     | 6.66        |
| Segmented labels on wells              | 4.5   | 5.53     | 5.53     | 5.56     | 5.53     | 5.56        |
| Links, cook time, card footer          | 4.5   | 5.23     | 5.66     | 5.48     | 5.22     | 5.67        |
| Splash "Welcome to"                    | 4.5   | 5.68     | 6.13     | 5.93     | 5.71     | 6.15        |
| Callout labels                         | 4.5   | 4.74     | 5.12     | 4.96     | 4.77     | 5.14        |
| Step numbers, chips, current menu item | 4.5   | 4.53     | 4.90     | 4.70     | 4.57     | 4.89        |
| Primary buttons, menu button           | 4.5   | 5.62     | 6.07     | 5.85     | 5.63     | 6.09        |
| Primary button hover                   | 4.5   | 6.40     | 6.93     | 6.68     | 6.38     | 6.97        |
| Cook Mode banner, drafts, tip label    | 4.5   | 8.62     | 8.63     | 8.63     | 8.59     | 8.64        |
| Theme switch sun icon                  | 3     | 9.64     | 9.64     | 9.69     | 9.57     | 9.66        |
| Active filter tab, toast               | 4.5   | 15.20    | 15.27    | 15.23    | 15.13    | 15.26       |
| Form field edge (WCAG 1.4.11)          | 3     | **1.80** | **1.80** | **1.81** | **1.81** | **1.81**    |
| Dashed empty-state and add-step edge   | 3     | **1.99** | **2.00** | **2.00** | **1.98** | **2.00**    |

## Appendix C · Font measurements

Measured in Chrome 154 from the Google Fonts files the app would load.

| Family                     | x-height (em) | Width index\* | I · l · 1 distinct                                      | Fractions in the font | Fractions Google delivers | Tabular figures |
| -------------------------- | ------------- | ------------- | ------------------------------------------------------- | --------------------- | ------------------------- | --------------- |
| Plus Jakarta Sans (today)  | 0.54          | 36.5          | No                                                      | All 9                 | ½ ¼ ¾                     | With `tnum`     |
| Source Sans 3              | 0.49          | 32.5          | Yes                                                     | All 9                 | ½ ¼ ¾                     | By default      |
| Public Sans                | 0.52          | 36.5          | Yes                                                     | All 9                 | ½ ¼ ¾                     | With `tnum`     |
| Atkinson Hyperlegible Next | 0.50          | 34.8          | Yes                                                     | ½ ¼ ¾                 | ½ ¼ ¾                     | With `tnum`     |
| Signika                    | 0.505         | 33.4          | Yes                                                     | All 9                 | ½ ¼ ¾                     | By default      |
| Inter (for reference)      | 0.52          | 34.0          | No: its I/l alternates are stripped from Google's build | All 9                 | ½ ¼ ¾                     | With `tnum`     |

\*Width of a fixed English and Polish sample sentence, in ems. Lower is narrower.

Also measured and ruled out:

- **Distinct and complete, but less suited here:** Fira Sans, IBM Plex Sans, Geist and Noto Sans. They're good fallbacks.
- **Identical I and l:** Figtree, DM Sans, Manrope, Google Sans and Lato.
- **Too thin for phones:** Playfair Display at text sizes, Noto Serif Display, Cormorant Garamond and EB Garamond.
