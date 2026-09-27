---
name: ship
description: Verify, review, commit, and (after explicit confirmation) push Family Kitchen changes to main, which deploys live to GitHub Pages. Use when the user says ship, release, deploy, commit and push, or "send it".
---

# /ship — release Family Kitchen

A push to `main` is a **live deploy to the family**. Never push without an explicit "yes" in this turn.

1. **Gate.** Run `npm run check` then `npm run build`. If either fails, fix the root cause and restart from step 1.
2. **Independent review.** Invoke the `code-review` skill at `medium` effort on everything not yet pushed: uncommitted changes plus commits ahead of `origin/main`. It reviews in a fresh context, so it isn't biased by having written the code.
   - Fix every correctness finding, add a regression test where the logic is testable, then return to step 1.
   - Cleanup and style findings are optional. Apply one only if it's cheap and clearly better. Don't chase them into over-engineering.
   - Report each finding's outcome with ReportFindings (`fixed` / `skipped` / `no_change_needed`).
3. **Project checklist.** Read the diff for things the tools can't catch:
   - Secrets or `.env` values, stray debug code, commented-out blocks.
   - New UI text present in `src/i18n/translations.ts` for both `en` and `pl`, in natural Polish.
   - Images replaced at an existing path under `public/` need a bump to `CACHE_NAME` in `public/sw.js`.
   - Recipe shape changes keep the version bookkeeping intact (`utils/recipeVersions`) and still load old records.
   - If `firestore.rules` changed, remind Peter to publish them in the Firebase console, and say whether that must happen before or after the push.
4. **UI changes:** confirm they were checked in the preview browser this session (light + dark, EN + PL, phone width). If not, do it now (`preview_start` name `dev`, see CLAUDE.md "Local UI testing").
5. **Commit.** Stage files by name (never `git add -A`). Make one focused commit per logical change, in the repo's style (`feat:`, `fix:`, `style:`, `refactor:`, `test:`, `docs:`, `chore:`): imperative, lower case, what and why.
6. **Confirm.** Show `git log --oneline origin/main..HEAD` and a short plain-language summary of what the family will notice. Ask: "Push to main and deploy?"
7. **Push** only on a clear yes: `git push origin main`. Tell the user the deploy runs at https://github.com/fatso33/famkit/actions and takes about 2 minutes. If CI fails, the site keeps the previous version.
