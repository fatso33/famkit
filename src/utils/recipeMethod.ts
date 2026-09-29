import { Ingredient, Step, StepFork } from '../types/recipe';

/**
 * The method's shape, shared by the recipe page and the editor: sections, step numbers and
 * forks. Numbers are worked out from the order. They run on across sections, skip unnumbered
 * text, and after a fork they follow the path the cook is on.
 */

/** A step's substeps are lettered a) to z), so it has at most one per letter. */
export const SUBSTEP_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A run of steps under one heading. */
export interface MethodSection {
  /** The heading as stored. Empty: the default heading. */
  title: string;
  /** Where its steps start in the recipe's steps. */
  start: number;
  steps: Step[];
}

/** The steps grouped by the sections they start. */
export function methodSections(steps: Step[]): MethodSection[] {
  const sections: MethodSection[] = [];
  steps.forEach((step, i) => {
    const current = sections.at(-1);
    if (!current || step.section !== undefined) {
      sections.push({ title: (step.section ?? '').trim(), start: i, steps: [step] });
    } else {
      current.steps.push(step);
    }
  });
  return sections;
}

/** A run of ingredient rows under one heading, each with its place in the recipe's list. */
export interface IngredientGroup {
  /** Empty for the rows before the first heading. */
  heading: string;
  rows: { ing: Ingredient; idx: number }[];
}

/** The ingredients grouped by the headings they start. A blank heading doesn't start one. */
export function ingredientGroups(ingredients: Ingredient[]): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  ingredients.forEach((ing, idx) => {
    const heading = (ing.section ?? '').trim();
    const current = groups.at(-1);
    if (!current || heading) groups.push({ heading, rows: [{ ing, idx }] });
    else current.rows.push({ ing, idx });
  });
  return groups;
}

/** What numbering needs to know about a step, in the recipe or in the editor. */
export interface NumberedItem {
  plain?: boolean;
  fork?: {
    paths: readonly { sameAsFirst?: boolean; steps?: readonly unknown[] }[];
  } | null;
}

/** Which path each fork is on, by the fork step's position. A fork not listed is on its first. */
export type PathChoices = Readonly<Record<number, number>>;

/** The path a fork is on: the chosen one if it still exists, else the first. */
export function chosenPath(fork: { paths: readonly unknown[] }, choice: number | undefined) {
  return choice !== undefined && choice > 0 && choice < fork.paths.length ? choice : 0;
}

/** How many steps of its own the path follows: its own, or the first path's when it shares them. */
export function pathStepCount(fork: NonNullable<NumberedItem['fork']>, index: number): number {
  const path = fork.paths[index] ?? fork.paths[0];
  const followed = index > 0 && path?.sameAsFirst ? fork.paths[0] : path;
  return followed?.steps?.length ?? 0;
}

/** The own steps a path follows: its own, or the first path's when it shares them. */
export function pathSteps(fork: StepFork, index: number): string[] {
  const path = fork.paths[index] ?? fork.paths[0];
  const followed = index > 0 && path?.sameAsFirst ? fork.paths[0] : path;
  return followed?.steps ?? [];
}

/**
 * The number the first numbered step gets. Wanda's bread numbers from 0, so a recipe whose
 * first numbered step is stored as 0 keeps doing so.
 */
export function firstStepNumber(steps: readonly Pick<Step, 'num' | 'plain'>[]): number {
  return steps.find((step) => !step.plain)?.num === 0 ? 0 : 1;
}

/**
 * Each step's number (null for unnumbered text). A fork's paths number their own steps on from
 * the fork, and the steps after it carry on from the path it's on.
 */
export function numberSteps(
  items: readonly NumberedItem[],
  start: number,
  choices: PathChoices = {},
): (number | null)[] {
  let next = start;
  return items.map((item, i) => {
    if (item.plain) return null;
    const number = next;
    next += 1;
    if (item.fork) next += pathStepCount(item.fork, chosenPath(item.fork, choices[i]));
    return number;
  });
}
