# Vibecoding playbook: Family Kitchen

A one-page guide for Peter to working with Claude on this repo. Claude's own rules live in `CLAUDE.md`. This page is about your habits.

## The loop

1. **Open a session in the `FamKit` folder**, not `Peter`. That's what loads the rules, hooks and `/ship`.
2. **One task per session.** Start a new session (or `/clear`) when you switch topics.
3. **Describe the outcome, the constraints, and how you'll know it works** (see the recipes below).
4. **Let it run.** Automatic checks stop Claude from finishing while anything is broken.
5. **Look at the result** in the preview pane. Claude should show you evidence.
6. **`/ship`** runs checks, an independent code review, the commit, and then asks you before deploying.

## Prompt recipes

**Small change** (you could describe the diff in one sentence):

> On the recipe card, show the number of steps next to the cook time. Keep it in both languages. Check it in the preview at phone width.

**Bigger feature** (several files, or you're not sure how it should work):

> I want family members to leave comments on recipes. Interview me with questions about how it should work before writing any code, then write a plan.

Switch to **Plan mode** first. Read the plan, push back, and only then approve.

**Bug**:

> When I switch to Polish on a new recipe I see two error toasts. Reproduce it with a failing test first, then fix the root cause.

Describe the symptom, where you saw it, and what "fixed" looks like.

**Understanding**:

> How does a recipe get from the form into Firestore? Don't change anything.

## Session habits

- **Stop early.** Press `Esc` the moment Claude heads the wrong way. Context is kept, so just redirect.
- **Undo freely.** Double-`Esc` / `/rewind` restores code and conversation to an earlier point, so it's cheap to let Claude try something risky.
- **Two-correction rule.** If you've corrected the same thing twice, start a fresh session with a better prompt. Accumulated failed attempts make Claude worse.
- **Answer product questions; delegate engineering.** Wording, layout and what the family sees are your calls. Claude should decide the technical details and tell you what it chose.
- **Push is deploy.** Only say "yes, push" when you've seen the summary and you're happy the family sees it now.

## What runs automatically (so you know what to trust)

| When                      | What                                                                            | Why                                                       |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Every file Claude edits   | Prettier formats it                                                             | No style drift between sessions                           |
| Before Claude says "done" | `npm run check`: types, lint (incl. accessibility, async safety), format, tests | Broken code can't be declared done                        |
| `/ship`                   | Build + fresh-context `/code-review` + project checklist                        | A second pair of eyes before the family sees it           |
| `git push`                | Always asks you; force-push is blocked                                          | Push = live deploy                                        |
| GitHub Actions            | Same `npm run check` + build, then deploy                                       | If CI fails, the live site stays on the last good version |

## Keeping it sharp

- **Claude repeats a mistake?** Ask it to add a one-line rule to `CLAUDE.md`, or better, a lint rule or test, which enforces itself.
- **Claude ignores a rule that's already there?** `CLAUDE.md` is probably too long. Prune rather than add.
- **Monthly:** ask Claude to run `npm outdated` and `npm audit` and propose safe upgrades.
- **Your to-dos outside the code** (Claude can't do these): put the real family emails in the deployed Firestore rules, and restrict the Gemini API key to your GitHub Pages domain in Google Cloud.
