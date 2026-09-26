---
name: ship
description: Verify, commit, and (after explicit confirmation) push Family Kitchen changes to main, which deploys live to GitHub Pages. Use when the user says ship, release, deploy, commit and push, or "send it".
---

# /ship — release Family Kitchen

A push to `main` is a **live deploy to the family**. Never push without an explicit "yes" in this turn.

1. **Gate.** Run `npm run check` then `npm run build`. If either fails, stop, fix, and restart from step 1.
2. **Review the diff.** `git status` + `git diff --stat`, then read the full diff. Look for:
   - Stray debug code (`console.log`, commented-out blocks), secrets, or `.env` values.
   - New UI strings missing from `src/i18n/translations.ts` (both `en` and `pl`).
   - Replaced images under `public/` at an existing path: bump `CACHE_NAME` in `public/sw.js` (images are cache-first, so the old file would stick).
   - Recipe shape changes without matching updates to versioning/history in `useRecipes.ts`.
3. **UI changes only:** confirm the change was checked in the preview browser this session; if not, do it now (`preview_start` name `dev`).
4. **Commit.** Stage files by name (never `git add -A`). One focused commit per logical change, message in the repo's style: `feat: …`, `fix: …`, `style: …`, `refactor: …`, `test: …`, `chore: …` — imperative, lower case, what + why.
5. **Confirm.** Show the user `git log --oneline -3` and a one-paragraph summary of what will go live. Ask: "Push to main and deploy?"
6. **Push** only on a clear yes: `git push origin main`. Then tell the user the deploy runs at https://github.com/fatso33/famkit/actions and takes ~2 minutes.
