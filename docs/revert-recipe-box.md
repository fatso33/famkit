# Reverting the Recipe Box redesign

Hand this file to an agent with: "Revert the Recipe Box redesign using docs/revert-recipe-box.md."

## What changed, and what to keep

Three commits, September 2026 (plus this note, `a333ba0`, which can stay):

| Commit                              | What                                                                                                                                                                 | Revert?                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `78277c9` (tagged `pre-recipe-box`) | Page renamed Recipe Box / Przepiśnik, PL "Makes" page renamed Popisy, sort by category by default, "Date added" and "Last changed" folded into one "Last added" sort | **No, keep it.** It isn't part of the design. |
| `28be500`                           | The Recipe Box design: stacked index cards, divider tabs, rolling pinned tab, lean-back on scroll, card-flip open/close                                              | **Yes.** This is the redesign.                |
| `dff7f82`                           | Photo cards show their description again, clamped to three lines; the fallback line moved into the translations (`cardDescriptionFallback`)                          | **Yes**, with the redesign (revert it first). |

The tag `pre-recipe-box` points at the last commit with the old design (it already has the renames and the new sort).

## How to revert

1. **Try the plain revert first.**

   ```bash
   git revert dff7f82 28be500
   ```

   If it applies cleanly, run `npm run check`, check the vault in the preview browser (light and dark, EN and PL, phone width, list and cards, open and close a recipe), and you're done.

2. **If it conflicts** (later commits touched the same files), restore the redesigned files from the tag, then carry the later changes back over by hand:

   ```bash
   git checkout pre-recipe-box -- src/App.tsx src/components/recipe-detail/RecipeDetailView.tsx src/components/recipe-detail/RecipeSubheader.tsx src/components/recipe-grid/RecipeCard.tsx src/components/recipe-grid/RecipeGridView.tsx src/components/recipe-grid/RecipeRow.tsx src/components/recipe-grid/VaultHeader.tsx src/components/recipe-grid/VaultToolbar.tsx src/hooks/useUnroll.ts src/index.css src/utils/viewTransition.ts src/utils/vault.ts src/utils/photoMorph.ts src/test/photoMorph.test.ts src/test/recipeUnroll.test.tsx src/test/vault.test.ts src/test/vaultToolbar.test.tsx src/test/viewTransition.test.ts
   ```

   Then delete the files the redesign added: `src/components/recipe-grid/{Monogram,VaultShelf,VaultTabLabel}.tsx`, `src/test/recipeFlip.test.tsx`, `src/test/vaultShelf.test.tsx`. Put `viewRecipe` back in `src/i18n/translations.ts` (interface, `en` "View Recipe →", `pl` "Zobacz przepis →") if the old RecipeCard uses it. Use `git diff pre-recipe-box -- <file>` to see what later commits changed in each file and re-apply those parts. Keep the renames and the category/Last added sort from `78277c9`. `npm run check` must pass.

3. **If the code has moved on too far for either**, rebuild the old design from the description below.

## The old design, precisely

**List layout.** `.vault-list` is a column with 1.4rem between groups. Each group is a `section.vault-list-group`: an `h2.vault-group-heading` (gold `--accent-gold`, 0.8rem, weight 700, 0.14em letter-spacing, uppercase) above one rounded card (`.vault-list-card`: 1px `--border-subtle`, `--radius-lg`, `--bg-surface`, overflow hidden) holding the group's rows. A row (`button.vault-row`) is a 4rem square photo on the left (corner radius `--radius-md` minus 2px), then the name (serif, 1.15rem) over "cook · time" (0.875rem, muted; the time in `--accent`, weight 600), then a chevron on the right. Rows are divided by a 1px hairline starting after the photo. Hover (hover-capable devices only) and press tint the row `--bg-card`. No overlap, no taper, no lean.

**Cards layout.** `.recipe-grid` is a grid, `repeat(auto-fill, minmax(320px, 1fr))`, gap 1.75rem, so one column on phones. A card (`.recipe-card`) has `--bg-surface`, a 1px border, `--radius-md`, and on hover lifts 4px with `--shadow-md`. Photo on top at 16:10 (it zooms to 1.03 on hover), then a body: title (serif 1.375rem), "By {author} · ⏱️ {time}", a description (`cardDescription`, else `tips`, else `notes`, else "A time-tested family favorite." / "Tradycyjny, sprawdzony przepis rodzinny."), and a footer with "View Recipe →" (or "Continue" for a draft) and the ingredient count.

**Headings.** Only when sorting by cook or by category (the group's name as the heading). Filtering didn't add a heading. With drafts showing: "Your drafts", then "Family recipes". No pinned heading: the headings scrolled away with the list.

**Opening a recipe.** A view transition (`motion: 'forward'`, `morph: 'recipe'`). The tapped card's photo morphs into the recipe's hero photo, uncropped inside a morphing frame (nested view-transition groups `recipe-frame` > `recipe-photo`, laid out by `utils/photoMorph`, its corners reshaping by clip-path from the card's to the hero's). The vault recedes (scale 0.96, fading). As the photo lands, the recipe unrolls down out of it (`hooks/useUnroll`): a clip-path reveal with a paper-roll bar (`.detail-roll`) travelling down the page, timed from the photo's flight (`recipePhotoLandsIn`). At 72% of the unroll the back button springs out of the menu button (`onUnrolled`).

**Closing a recipe.** The recipe rolls back up into its photo (`rollUp()` on the page handle; the recipe page's pinned subheader tucks away first via its `hidden` prop), and the back button tucks into the menu button. Then a view transition flies the photo back into its card (clip-path to the card's corners) as the vault comes forward. Where the photo is off screen, the vault fades in instead. App kept `<html data-vault-view>` so a list row's photo corners (`--card-photo-corners`) were known after the vault had unmounted.

**Arriving at the vault.** The first recipes rose 1.5rem into place, staggered.
