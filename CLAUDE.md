# Family Kitchen (FamKit)

Private family recipe vault PWA. React 19 + TypeScript (strict) + Vite 6 + Tailwind 4 + Firebase 12 (Google auth + Firestore), with Gemini (via Firebase AI Logic) for two-way EN↔PL recipe translation. Static SPA on GitHub Pages. Real family members use it on phones, so **every push to `main` is a live deploy**.

## Commands

- `npm run dev`: dev server on :3000, or `$PORT` if set (preview browser: `preview_start` name `dev`, which auto-assigns a port when parallel sessions are running)
- `npm run check`: typecheck + ESLint + Prettier check + Vitest. **This is the gate.** It must be green before a task counts as done.
- `npm run format`: Prettier. A hook already formats every file Claude edits, so you rarely need it.
- `npm run build`: production build (also runs tsc)
- `npm run test:watch`, `npx vitest run src/test/<file>`: focused tests
- `/ship`: verify, commit, confirm, push (deploy)

## Layout

- `src/components/{auth,common,layout,recipe-detail,recipe-form,recipe-grid}`: UI, one component per file
- `src/hooks/`: state and side effects (`useRecipes` = local + Firestore sync + versioning; `useAuth` = Google sign-in + family allowlist)
- `src/services/`: I/O only (`firebase`, `firestore`, `storage` = localStorage, `gemini`)
- `src/utils/`: pure logic (`fractions` = scaling/formatting, `timeEstimator`)
- `src/i18n/translations.ts`: all UI strings, typed by the `UiTranslations` interface
- `src/data/wandasCheeseBread.ts`: one-time seed for adopting Wanda's Cheese Bread as Peter's upload (`utils/legacyAdoption`). Its content is **verbatim heirloom text**. Never paraphrase it. Tests use the copy in `src/test/fixtures/`.
- `src/test/`: Vitest + Testing Library (jsdom)
- `public/sw.js`: hand-written service worker. `public/assets/`: recipe photos

## Conventions

- Imports are relative (`../hooks/useX`). The `@/` alias exists, but the code doesn't use it, so stay consistent.
- New UI text goes in `UiTranslations`, with **both `en` and `pl`** entries (tsc enforces this). Polish must be natural culinary Polish with correct plural forms. Never hard-code strings in JSX.
- Styling uses the heirloom design tokens in `src/index.css` (`--bg-*`, `--text-*`, `--border-*`, Fraunces/Plus Jakarta Sans). Dark mode is `[data-theme="dark"]`. Reuse existing classes before adding new ones.
- Changes to the recipe shape go through `src/types/recipe.ts`. Keep `version`/`history` intact (see `useRecipes.ts`), and handle old records with optional fields.
- Pure logic goes in `utils/` and gets a test in `src/test/`. Bug fixes get a regression test when the logic is testable.
- Don't sync state in effects (`react-hooks/set-state-in-effect`). Use lazy `useState` initializers, derive values during render, or remount with a `key` (see `AddRecipeModal`, `ImageZoomModal`). Keep effects for external systems only.
- Modals are mounted only while open (`{open && <Modal/>}`) and use `useDialogDismiss` for Escape and backdrop close.

## Engineering standards

Tools enforce most of these: TS strict, ESLint (react-hooks, jsx-a11y, promise safety), Prettier. **Fix the root cause. Never silence a rule to get green.** A rare justified `eslint-disable` needs a comment on the line above saying why and what the keyboard/user alternative is.

- **Accessibility** (older relatives, phones, large-text mode):
  - Interactive things are `<button>`/`<a>`. A clickable non-button needs `role`, `tabIndex={0}`, Enter/Space handling and a `:focus-visible` style.
  - Icon-only buttons need an `aria-label`.
  - Text sizes use `rem` so the font-scale setting works.
  - Touch targets are at least 44px.
- **Errors and async:**
  - No floating promises. `await`, `.catch`, or `void` a call whose errors are handled inside.
  - Offline, Firestore and Gemini failures fall back to local data. Never a blank screen or an endless spinner.
  - User-facing errors are translated toasts. Never report success before it happened.
  - `console.warn` gets a context message.
- **Privacy and security:** this is a private family vault.
  - No new third-party services, scripts, analytics or trackers without asking Peter.
  - No `dangerouslySetInnerHTML` with recipe or user data.
  - Treat Gemini/Firestore responses as untrusted input.
- **Performance:** assume a phone on kitchen Wi-Fi.
  - New images go through the existing compression (`ImagePickerWithPreview`).
  - No new dependency without a stated reason in the commit message. Prefer the platform and existing libraries.
- **Testing:**
  - Bug fix: write a failing test first (see `autoTranslate.test.tsx`), then fix.
  - New logic: add unit tests.
  - Component tests query by role/label, which also checks accessibility. Render real components rather than mocking them. Mock only I/O (`services/`).

## How to work

- **Understand first.** Read the code involved. For multi-file or ambiguous changes, plan first and confirm with Peter.
- **Know whose call it is.** Product decisions are Peter's: what the family sees, wording, UX. Engineering details are yours, so decide and say what you chose.
- **Keep changes small and focused.** Don't refactor unrelated code in passing. Flag out-of-scope issues rather than silently fixing or ignoring them.
- **Show evidence, not "should work".** Test output, the command run, a screenshot.
- **Review before shipping.** `/ship` runs `/code-review` on the diff. Fix correctness findings, and treat style nits as optional.
- **When compacting,** keep the list of modified files, what has been verified, and what's still pending.

## Gotchas

- **Service worker:** JS/CSS/HTML are network-first, but images are **cache-first**. If you replace an image at an existing path, bump `CACHE_NAME` in `public/sw.js`, or users keep seeing the old one.
- **Secrets:** `VITE_*` env vars are baked into the public bundle. Never commit `.env`. CI reads them from GitHub Secrets (`deploy.yml`).
- **Access control** has two layers that must agree: the `VITE_FAMILY_EMAILS` secret (client UX) and the email list in `firestore.rules` (real enforcement, deployed separately via the Firebase CLI/console).
- **Local UI testing:** there's no local `.env`, so Firebase is off in dev. "Connect with Google" logs in as a fake dev user, and data stays in localStorage, so it's safe to click through anything. The vault starts empty: no recipe is built into the app. In the preview browser, the hidden pane stalls `document.startViewTransition`. If navigation clicks do nothing, run `document.startViewTransition = undefined` in the page first.
- **Offline-first:** Firestore uses IndexedDB persistence, and recipes also live in localStorage. Test changes signed out (local-only) as well as signed in.
- **Translation:** a recipe's top-level text is the original in `sourceLanguage`, and `translations[other]` carries a `sourceHash`. A mismatched hash means the translation is stale, and `useRecipes` re-translates it in the background. The logic lives in `utils/recipeTranslation`. Firebase is off locally, so translation only runs in tests (mocked) or with a real `.env` plus an App Check debug token.
- **Images:** photos are compressed client-side and embedded. Keep history snapshots free of embedded photos (see `useRecipes`).

## Definition of done

1. `npm run check` is green. A Stop hook enforces this automatically whenever code changed.
2. UI changes were checked in the preview browser (light + dark, EN + PL, phone width).
3. Commit in the repo style (`feat:`, `fix:`, `style:`, `refactor:`, `test:`, `chore:`).
4. **Don't push without Peter's explicit OK.** Use `/ship`.

## Recipes and ownership

- Every recipe is one a family member added. There is no built-in or default recipe.
- `ownerEmail` is who added it, and only they can edit it (`utils/ownership` for the UI, `firestore.rules` for real enforcement). Any phone may still write translation fields.
- `author` is the displayed name. `authorMode: 'auto'` means it's the owner's Google name, and `'custom'` means it's someone else's recipe (an heirloom) with a typed name.

## Known risks (not yet addressed)

- `firestore.rules` in the repo still holds placeholder emails. Confirm the deployed rules contain the real family list.
