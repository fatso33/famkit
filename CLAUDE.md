# Family Kitchen (FamKit)

Private family recipe vault PWA. React 19 + TypeScript (strict) + Vite 6 + Tailwind 4 + Firebase 12 (Google auth + Firestore), with Gemini for EN→PL recipe translation. Static SPA on GitHub Pages. Real family members use it on phones, so **every push to `main` is a live deploy**.

## Commands
- `npm run dev`: dev server on :3000, or `$PORT` if set (preview browser: `preview_start` name `dev`, which auto-assigns a port when parallel sessions are running)
- `npm run check`: typecheck + ESLint + Vitest. **This is the gate.** It must be green before a task counts as done.
- `npm run build`: production build (also runs tsc)
- `npm run test:watch`, `npx vitest run src/test/<file>`: focused tests
- `/ship`: verify, commit, confirm, push (deploy)

## Layout
- `src/components/{auth,common,layout,recipe-detail,recipe-form,recipe-grid}`: UI, one component per file
- `src/hooks/`: state and side effects (`useRecipes` = local + Firestore sync + versioning; `useAuth` = Google sign-in + family allowlist)
- `src/services/`: I/O only (`firebase`, `firestore`, `storage` = localStorage, `gemini`)
- `src/utils/`: pure logic (`fractions` = scaling/formatting, `timeEstimator`)
- `src/i18n/translations.ts`: all UI strings, typed by the `UiTranslations` interface
- `src/data/defaultRecipe.ts`: canonical Wanda's Cheese Bread. Its content is **verbatim heirloom text**. Never paraphrase it.
- `src/test/`: Vitest + Testing Library (jsdom)
- `public/sw.js`: hand-written service worker. `public/assets/`: recipe photos

## Conventions
- Imports are relative (`../hooks/useX`). The `@/` alias exists, but the code doesn't use it, so stay consistent.
- New UI text goes in `UiTranslations`, with **both `en` and `pl`** entries (tsc enforces this). Polish must be natural culinary Polish with correct plural forms. Never hard-code strings in JSX.
- Styling uses the heirloom design tokens in `src/index.css` (`--bg-*`, `--text-*`, `--border-*`, Fraunces/Plus Jakarta Sans). Dark mode is `[data-theme="dark"]`. Reuse existing classes before adding new ones.
- Changes to the recipe shape go through `src/types/recipe.ts`. Keep `version`/`history` intact (see `useRecipes.ts`), and handle old records with optional fields.
- Pure logic goes in `utils/` and gets a test in `src/test/`. Bug fixes get a regression test when the logic is testable.
- Don't sync state in effects (`react-hooks/set-state-in-effect`). Use lazy `useState` initializers, derive values during render, or remount with a `key` (see `AddRecipeModal`, `ImageZoomModal`). Keep effects for external systems only.
- Keep changes small and focused. Don't refactor unrelated code in passing.

## Gotchas
- **Service worker:** JS/CSS/HTML are network-first, but images are **cache-first**. If you replace an image at an existing path, bump `CACHE_NAME` in `public/sw.js`, or users keep seeing the old one.
- **Secrets:** `VITE_*` env vars are baked into the public bundle. Never commit `.env`. CI reads them from GitHub Secrets (`deploy.yml`).
- **Access control** has two layers that must agree: the `VITE_FAMILY_EMAILS` secret (client UX) and the email list in `firestore.rules` (real enforcement, deployed separately via the Firebase CLI/console).
- **Offline-first:** Firestore uses IndexedDB persistence, and recipes also live in localStorage. Test changes signed out (local-only) as well as signed in.
- **Images:** photos are compressed client-side and embedded. Keep history snapshots free of embedded photos (see `useRecipes`).

## Definition of done
1. `npm run check` is green. A Stop hook enforces this automatically whenever code changed.
2. UI changes were checked in the preview browser (light + dark, EN + PL, phone width).
3. Commit in the repo style (`feat:`, `fix:`, `style:`, `refactor:`, `test:`, `chore:`).
4. **Don't push without Peter's explicit OK.** Use `/ship`.

## Known risks (not yet addressed)
- `firestore.rules` in the repo still holds placeholder emails. Confirm the deployed rules contain the real family list.
- The Gemini API key ships in the client bundle. It should be restricted by HTTP referrer (GitHub Pages domain) in Google Cloud.
