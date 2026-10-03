import { Language, Recipe, Step } from '../types/recipe';
import { UiTranslations } from '../i18n/translations';
import { parseIngredientRow } from './fractions';
import {
  PathChoices,
  SUBSTEP_LETTERS,
  firstStepNumber,
  ingredientGroups,
  methodSections,
  numberSteps,
  pathExtras,
  pathSteps,
} from './recipeMethod';
import { addedByName, creditName } from './ownership';
import { capitalizeFirstLetter } from './timeEstimator';
import { recipeTimeLabel } from './timeText';
import { recipePhoto } from './vault';

/**
 * A recipe as its PDF shows it: the words the recipe page shows, in the language it's shown in,
 * at the amounts it was written with. Nothing on paper can be tapped, so there's no scaler and
 * no remix marks, and a step done one of several ways lists every way.
 */

export interface PrintIngredient {
  name: string;
  amount: string;
  /** The note under the name ("sifted"), or ''. */
  note: string;
  /** The suggested stand-in ("or Margarine · 100 g"), or ''. */
  substitute: string;
}

export interface PrintIngredientGroup {
  /** '' for the rows before the first heading. */
  heading: string;
  rows: PrintIngredient[];
}

/** A tip or a photo shown with a step (photos only when the PDF includes them). */
export interface PrintExtras {
  note: string;
  photo?: string;
}

export interface PrintPath extends PrintExtras {
  label: string;
  text: string;
  /** The steps only this way has. On paper they're numbered within the path. */
  steps: string[];
}

export type PrintStep =
  | ({ kind: 'step'; number: number; text: string; substeps: string[] } & PrintExtras)
  | ({ kind: 'plain'; text: string } & PrintExtras)
  | { kind: 'fork'; number: number; paths: PrintPath[] };

export interface PrintSection {
  heading: string;
  steps: PrintStep[];
}

/** A bulleted list after the method: the older recipes' lamination and baking options. */
export interface PrintList {
  heading: string;
  groups: { label: string; items: string[] }[];
}

export interface PrintableRecipe {
  title: string;
  /** The recipe's author as credited (the file's author). */
  author: string;
  /** "By Wanda G.", "Added by Peter G.", and the time. */
  credits: string[];
  photo?: string;
  /** The recipe's own yield ("For 1 loaf:"), or ''. */
  yieldText: string;
  ingredients: PrintIngredientGroup[];
  /** The kitchen tip and the crucial note, each under its label. */
  callouts: { label: string; text: string }[];
  method: PrintSection[];
  lists: PrintList[];
  labels: {
    ingredients: string;
    chooseOne: string;
    footer: string;
  };
  language: Language;
}

/** The substeps as the recipe page letters them, "a)" to "z)". */
export function substepLabel(index: number): string {
  return `${SUBSTEP_LETTERS[index] ?? index + 1})`;
}

function sentences(value: string | string[] | undefined, split: boolean): string[] {
  if (!value) return [];
  const parts = Array.isArray(value) ? value : split ? value.split(/(?<=[.!?])\s+/) : [value];
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map(capitalizeFirstLetter);
}

function photoOf(on: { hasImage?: boolean; imageSrc?: string }, photos: boolean) {
  return photos && on.hasImage && on.imageSrc ? on.imageSrc : undefined;
}

/** Whether a recipe has any photo a PDF could include: its own, or a step's. */
export function hasPrintablePhotos(recipe: Recipe): boolean {
  if (recipePhoto(recipe)) return true;
  return (recipe.steps ?? []).some(
    (step) =>
      Boolean(photoOf(step, true)) ||
      (step.fork?.paths ?? []).some((path, i) => i > 0 && Boolean(photoOf(path, true))),
  );
}

/**
 * The PDF's content. `recipe` is the recipe as shown in `language` (useRecipes'
 * getLocalizedRecipe). `choices` is the way each fork was last followed on this phone, which
 * only the estimated time goes by.
 */
export function printableRecipe(
  recipe: Recipe,
  language: Language,
  t: UiTranslations,
  options: { photos: boolean; choices?: PathChoices },
): PrintableRecipe {
  const { photos, choices = {} } = options;
  const steps: Step[] = recipe.steps ?? [];

  const timeLabel = recipeTimeLabel(recipe, t, choices);
  const addedBy = addedByName(recipe);
  const credits = [
    t.byAuthor(creditName(recipe)),
    ...(addedBy ? [t.addedBy(addedBy)] : []),
    // Nothing to tell the time from (no timed steps): no time, rather than "~0m".
    ...(timeLabel ? [t.pdfTime(timeLabel)] : []),
  ];

  const ingredients = ingredientGroups(recipe.ingredients ?? []).map((group) => ({
    heading: group.heading,
    rows: group.rows.map(({ ing }) => {
      const row = parseIngredientRow(ing, 1, language);
      return {
        name: row.name,
        amount: row.amount,
        note: row.notes.join(', '),
        substitute: row.substitute
          ? t.orSubstitute(row.substitute.name) +
            (row.substitute.amount ? ` · ${row.substitute.amount}` : '')
          : '',
      };
    }),
  }));

  // On paper every way of a fork is shown, so the steps after one number on from the fork
  // itself, whichever way is followed.
  const numbers = numberSteps(
    steps.map((s) => ({ plain: s.plain, restart: s.restart })),
    firstStepNumber(steps),
  );
  const method = methodSections(steps).map((section, s) => ({
    heading: section.title || (s === 0 ? t.prepSteps : t.moreSteps),
    steps: section.steps.map((step, k): PrintStep => {
      const idx = section.start + k;
      if (step.plain) {
        return {
          kind: 'plain',
          text: capitalizeFirstLetter(step.text),
          note: capitalizeFirstLetter(step.notes ?? ''),
          photo: photoOf(step, photos),
        };
      }
      const number = numbers[idx] ?? 0;
      if (step.fork && step.fork.paths.length >= 2) {
        const fork = step.fork;
        return {
          kind: 'fork',
          number,
          paths: fork.paths.map((path, i) => {
            const extras = pathExtras(step, i);
            return {
              label: path.label.trim() || t.pathLetter(i),
              text: capitalizeFirstLetter(path.text),
              steps: pathSteps(fork, i).map(capitalizeFirstLetter),
              note: capitalizeFirstLetter(extras.notes ?? ''),
              photo: photoOf(extras, photos),
            };
          }),
        };
      }
      return {
        kind: 'step',
        number,
        text: capitalizeFirstLetter(step.text),
        substeps: (step.substeps ?? []).map(capitalizeFirstLetter),
        note: capitalizeFirstLetter(step.notes ?? ''),
        photo: photoOf(step, photos),
      };
    }),
  }));

  const lists: PrintList[] = [];
  const lamination = sentences(recipe.laminationDirective, true);
  if (lamination.length > 0) {
    lists.push({ heading: t.laminationDirective, groups: [{ label: '', items: lamination }] });
  }
  const baking = [
    { label: t.option1Tag, items: sentences(recipe.bakingOptions?.option1, true) },
    { label: t.option2Tag, items: sentences(recipe.bakingOptions?.option2, false) },
  ].filter((g) => g.items.length > 0);
  if (baking.length > 0) lists.push({ heading: t.bakingOptions, groups: baking });

  const callouts = [
    { label: t.kitchenTip, text: capitalizeFirstLetter(recipe.tips ?? '') },
    { label: t.crucialNote, text: capitalizeFirstLetter(recipe.notes ?? '') },
  ].filter((c) => c.text.trim());

  return {
    title: recipe.name,
    author: creditName(recipe),
    credits,
    photo: photos ? recipePhoto(recipe) || undefined : undefined,
    yieldText: recipe.yieldHeader ?? t.for1Loaf,
    ingredients,
    callouts,
    method,
    lists,
    labels: { ingredients: t.ingredients, chooseOne: t.chooseOne, footer: t.pdfFooter },
    language,
  };
}

/** Characters no file name may hold on the phones and computers the family uses. */
const UNSAFE_IN_NAMES = /[\\/:*?"<>|\p{Cc}\p{Cf}]/gu;

/** The PDF's file name: the recipe's name, as far as a file name can carry it. */
export function recipePdfName(title: string, fallback: string): string {
  const name = title
    .replace(UNSAFE_IN_NAMES, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120)
    .trim();
  return `${name || fallback}.pdf`;
}
