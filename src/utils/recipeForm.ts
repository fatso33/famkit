import {
  AuthorMode,
  BakingOptions,
  ForkPath,
  Ingredient,
  Recipe,
  RecipeCategory,
  Step,
} from '../types/recipe';
import { isRecipeCategory, recipePhoto } from './vault';
import { TIME_KINDS, TimeTexts, timesFromText } from './timeText';
import { authorModeOf } from './ownership';
import {
  SUBSTEP_LETTERS,
  chosenPath,
  firstStepNumber,
  methodSections,
  numberSteps,
} from './recipeMethod';

/**
 * The recipe editor's state and the pure edits made to it. The form holds text as typed; it
 * becomes a Recipe on save (formToRecipe), dropping what's empty.
 */

// One substep per letter, a) to z).
export const MAX_SUBSTEPS = SUBSTEP_LETTERS.length;
export const MAX_PATHS = 3;
export const DEFAULT_YIELD = 'For 1 loaf:';

let idCount = 0;
/** An id for a row, step or section, unique for this session. */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCount++).toString(36)}`;

/** An ingredient row's text, as compared to tell an edited row from an untouched one. */
interface RowText {
  name: string;
  amount: string;
  note: string;
  substitute: string;
  substituteAmount: string;
}

export interface IngredientRowState extends RowText {
  id: string;
  /**
   * A heading over the rows below it (its words are in `name`), not an ingredient. It's saved
   * as the `section` of the next ingredient.
   */
  heading?: boolean;
  /** Whether the note field is open (it can be while still empty). */
  showNote: boolean;
  showSubstitute: boolean;
  /**
   * The stored row it came from, with its text as first shown. While the row is untouched it's
   * written back as it was, so amounts stored as numbers (e.g. Wanda's) still scale.
   */
  source?: { ingredient: Ingredient; shown: RowText };
  /** Its position in the loaded recipe, for highlighting what a restored version changes. */
  origin?: number;
}

export interface TextItem {
  id: string;
  text: string;
}

/** A step's (or a fork path's) tip and photo. */
export interface ExtrasState {
  tip: string;
  /** Whether the tip field is open (it can be while still empty). */
  showTip: boolean;
  imageSrc: string;
  imageCaption: string;
}

export interface PathState extends ExtrasState {
  id: string;
  label: string;
  text: string;
  sameAsFirst: boolean;
  steps: TextItem[];
}

export interface ForkState {
  paths: PathState[];
  /** The path open in the editor. */
  active: number;
}

export interface StepState extends ExtrasState {
  id: string;
  /** What to do. A fork's paths each have their own, and their own tip and photo too. */
  text: string;
  plain: boolean;
  substeps: TextItem[];
  fork: ForkState | null;
  origin?: number;
}

export interface SectionState {
  id: string;
  /** Empty: the default heading. */
  title: string;
  /** Its steps are numbered from the start again (not for the first section). */
  restart: boolean;
  steps: StepState[];
}

export interface FormState {
  title: string;
  authorMode: AuthorMode;
  /** The typed name, used when the recipe is someone else's. */
  author: string;
  /** Empty until picked: a new recipe, or an older one saved before categories. */
  category: RecipeCategory | '';
  cardDescription: string;
  yieldHeader: string;
  heroImage: string;
  tips: string;
  notes: string;
  /** Prep, cook and rest as the author types them ("20 min", "overnight"). */
  times: TimeTexts;
  /**
   * Legacy: the total time an older recipe was given, in minutes; null when none. Kept while no
   * time is typed, cleared once one is.
   */
  manualMinutes: number | null;
  ingredientRows: IngredientRowState[];
  sections: SectionState[];
  /** The first numbered step's number: 1, or 0 for a recipe that starts at 0. */
  numberFrom: number;
  /** The web page the recipe was brought in from; empty when it was typed. */
  sourceUrl: string;
}

/** A web address as kept with a recipe: http(s) only, else empty. */
export function webAddress(text: string): string {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/** Words the editor needs to turn an older recipe's extra blocks into steps. */
export interface LegacyLabels {
  /** Heading for the section its baking options become. */
  bakingSection: string;
  /** Names of its two baking options, for the fork's switch. */
  bakingPaths: readonly [string, string];
}

// --- New pieces -----------------------------------------------------------------------------

export const emptyRow = (): IngredientRowState => ({
  id: newId('ing'),
  name: '',
  amount: '',
  note: '',
  showNote: false,
  substitute: '',
  substituteAmount: '',
  showSubstitute: false,
});

export const headingRow = (name = ''): IngredientRowState => ({
  ...emptyRow(),
  id: newId('head'),
  heading: true,
  name,
});

/** The ingredient rows (not headings). */
export const ingredientRowsOnly = (rows: IngredientRowState[]) => rows.filter((r) => !r.heading);

export const textItem = (text = ''): TextItem => ({ id: newId('txt'), text });

const noExtras = (): ExtrasState => ({ tip: '', showTip: false, imageSrc: '', imageCaption: '' });

/** The tip and photo alone, to hand from a step to a fork path or back. */
const extrasOf = ({ tip, showTip, imageSrc, imageCaption }: ExtrasState): ExtrasState => ({
  tip,
  showTip,
  imageSrc,
  imageCaption,
});

export const emptyStep = (text = ''): StepState => ({
  id: newId('step'),
  text,
  plain: false,
  substeps: [],
  ...noExtras(),
  fork: null,
});

export const emptySection = (title = ''): SectionState => ({
  id: newId('sec'),
  title,
  restart: false,
  steps: [emptyStep()],
});

const emptyPath = (text = '', sameAsFirst = false): PathState => ({
  id: newId('path'),
  label: '',
  text,
  sameAsFirst,
  steps: [],
  ...noExtras(),
});

/** Stored tip and photo fields as the form's. */
const extrasFrom = (from: {
  notes?: string;
  imageSrc?: string;
  imageCaption?: string;
}): ExtrasState => ({
  tip: from.notes ?? '',
  showTip: Boolean(from.notes?.trim()),
  imageSrc: from.imageSrc ?? '',
  imageCaption: from.imageCaption ?? '',
});

export const emptyForm = (): FormState => ({
  title: '',
  authorMode: 'auto',
  author: '',
  category: '',
  cardDescription: '',
  yieldHeader: '',
  heroImage: '',
  tips: '',
  notes: '',
  times: { prep: '', cook: '', rest: '' },
  manualMinutes: null,
  ingredientRows: [emptyRow()],
  sections: [emptySection()],
  numberFrom: 1,
  sourceUrl: '',
});

// --- From a recipe --------------------------------------------------------------------------

/** The typed times' words, from a recipe or a draft (checked: records are untrusted). */
function timeTextsOf(raw: unknown): TimeTexts {
  const texts: TimeTexts = { prep: '', cook: '', rest: '' };
  if (typeof raw !== 'object' || raw === null) return texts;
  for (const kind of TIME_KINDS) {
    const value = (raw as Record<string, unknown>)[kind];
    // A recipe keeps { text, minutes }; a draft's form keeps the words alone.
    const text =
      typeof value === 'string'
        ? value
        : typeof value === 'object' && value !== null
          ? (value as { text?: unknown }).text
          : '';
    if (typeof text === 'string') texts[kind] = text.slice(0, 80);
  }
  return texts;
}

// Takes (bracketed notes) out of text: "Water (very warm)" → "Water" and "very warm".
function takeBrackets(text: string, notes: string[]): string {
  return text
    .replace(/\(([^)]+)\)|\[([^\]]+)\]/g, (_m, round?: string, square?: string) => {
      const inner = (round ?? square ?? '').trim();
      if (inner && !notes.includes(inner)) notes.push(inner);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitNameAmount(raw: string): { name: string; amount: string } {
  if (raw.includes(' - ')) {
    const parts = raw.split(' - ');
    return { name: parts[0].trim(), amount: parts.slice(1).join(' - ').trim() };
  }
  return { name: raw.trim(), amount: '' };
}

function rowFromIngredient(ing: Ingredient, origin: number): IngredientRowState {
  const raw = ing.text || '';
  let shown: RowText;
  if (ing.note !== undefined) {
    // Saved by the current editor: the note is its own field, and brackets are just text.
    const { name, amount } =
      ing.name !== undefined && raw.startsWith(ing.name)
        ? { name: ing.name, amount: raw.slice(ing.name.length).replace(/^\s*-\s*/, '') }
        : splitNameAmount(raw);
    shown = {
      name: name.trim(),
      amount: amount.trim(),
      note: ing.note.trim(),
      substitute: '',
      substituteAmount: '',
    };
  } else {
    // Older rows keep notes in brackets; the note gets its own field now.
    let { name, amount } = splitNameAmount(raw);
    if (ing.name && ing.qty !== undefined && ing.qty !== null) {
      name = ing.name;
      amount = `${ing.qty} ${ing.unit || ''}`.trim();
    } else if (!raw.includes(' - ')) {
      // Also covers translated rows, which carry a name but no quantity field.
      name = raw || ing.name || '';
      amount = '';
    }
    const notes: string[] = [];
    name = takeBrackets(name, notes);
    amount = takeBrackets(amount, notes);
    shown = { name, amount, note: notes.join(', '), substitute: '', substituteAmount: '' };
  }
  shown.substitute = (ing.substitute ?? '').trim();
  shown.substituteAmount = (ing.substituteAmount ?? '').trim();
  return {
    id: newId('ing'),
    ...shown,
    showNote: Boolean(shown.note),
    showSubstitute: Boolean(shown.substitute || shown.substituteAmount),
    source: { ingredient: ing, shown: { ...shown } },
    origin,
  };
}

function stepFromRecipe(step: Step, origin: number): StepState {
  const paths = step.fork?.paths ?? [];
  const forked = paths.length >= 2;
  return {
    id: newId('step'),
    text: step.text ?? '',
    plain: Boolean(step.plain),
    substeps: (step.substeps ?? []).slice(0, MAX_SUBSTEPS).map((s) => textItem(s)),
    // A fork's own tip and photo are its first path's.
    ...(forked ? noExtras() : extrasFrom(step)),
    fork: forked
      ? {
          active: 0,
          paths: paths.slice(0, MAX_PATHS).map((p: ForkPath, i) => ({
            id: newId('path'),
            label: p.label ?? '',
            text: p.text ?? (i === 0 ? step.text : ''),
            sameAsFirst: i > 0 && Boolean(p.sameAsFirst),
            steps: (p.steps ?? []).map((s) => textItem(s)),
            ...extrasFrom(i === 0 ? step : p),
          })),
        }
      : null,
    origin,
  };
}

const asText = (option: string | string[]) => (Array.isArray(option) ? option.join(' ') : option);
const asList = (option: string | string[]) => (Array.isArray(option) ? option : [option]);

/**
 * An older recipe's extra blocks, as steps: its lamination directive becomes unnumbered text
 * after the steps, and its two baking options a Baking section with a fork. The words stay
 * exactly as they were.
 */
function legacyMethod(recipe: Recipe, labels: LegacyLabels, sections: SectionState[]) {
  const directive = recipe.laminationDirective?.trim();
  if (directive) {
    sections.at(-1)!.steps.push({ ...emptyStep(directive), plain: true });
  }

  const { option1, option2 }: BakingOptions = recipe.bakingOptions ?? {};
  const first = option1 ? asText(option1).trim() : '';
  const second = option2
    ? asList(option2)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (!first && second.length === 0) return;

  let steps: StepState[];
  if (first && second.length > 0) {
    const fork: ForkState = {
      active: 0,
      paths: [
        { ...emptyPath(first), label: labels.bakingPaths[0] },
        {
          ...emptyPath(second[0]),
          label: labels.bakingPaths[1],
          steps: second.slice(1).map((s) => textItem(s)),
        },
      ],
    };
    steps = [{ ...emptyStep(first), fork }];
  } else {
    steps = (first ? [first] : second).map((text) => emptyStep(text));
  }
  sections.push({ id: newId('sec'), title: labels.bakingSection, restart: false, steps });
}

/** The form for editing a recipe. */
export function formFromRecipe(recipe: Recipe, labels: LegacyLabels): FormState {
  const authorMode = authorModeOf(recipe);
  const steps = recipe.steps ?? [];
  const sections: SectionState[] = methodSections(steps).map((section, s) => ({
    id: newId('sec'),
    title: section.title,
    restart: s > 0 && Boolean(section.steps[0]?.restart),
    steps: section.steps.map((step, k) => stepFromRecipe(step, section.start + k)),
  }));
  if (sections.length === 0) sections.push(emptySection());
  legacyMethod(recipe, labels, sections);

  return {
    title: recipe.name || '',
    authorMode,
    author: authorMode === 'custom' ? recipe.author || '' : '',
    category: isRecipeCategory(recipe.category) ? recipe.category : '',
    cardDescription: recipe.cardDescription || '',
    // A recipe saved without a yield keeps none; older records missing the field get the default.
    yieldHeader: recipe.yieldHeader ?? DEFAULT_YIELD,
    // An older recipe saved with a stock photo in place of its own starts with none.
    heroImage: recipePhoto(recipe),
    tips: recipe.tips || '',
    notes: recipe.notes || '',
    times: timeTextsOf(recipe.times),
    manualMinutes:
      typeof recipe.manualMinutes === 'number' && recipe.manualMinutes > 0
        ? recipe.manualMinutes
        : null,
    ingredientRows:
      recipe.ingredients?.length > 0
        ? recipe.ingredients.flatMap((ing, i) => {
            const row = rowFromIngredient(ing, i);
            return ing.section?.trim() ? [headingRow(ing.section.trim()), row] : [row];
          })
        : [emptyRow()],
    sections,
    numberFrom: firstStepNumber(steps),
    sourceUrl: webAddress(recipe.sourceUrl ?? ''),
  };
}

// --- From a saved draft ---------------------------------------------------------------------

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(isObject) : []);
const texts = (v: unknown, max = Infinity): TextItem[] =>
  (Array.isArray(v) ? v : [])
    .map((item) => (typeof item === 'string' ? item : isObject(item) ? str(item.text) : null))
    .filter((t): t is string => t !== null)
    .slice(0, max)
    .map((t) => textItem(t));

function draftRow(raw: Json): IngredientRowState {
  if (raw.heading === true) return headingRow(str(raw.name));
  const row: IngredientRowState = {
    ...emptyRow(),
    name: str(raw.name),
    amount: str(raw.amount),
    note: str(raw.note),
    substitute: str(raw.substitute),
    substituteAmount: str(raw.substituteAmount),
  };
  row.showNote = raw.showNote === true || Boolean(row.note);
  row.showSubstitute = raw.showSubstitute === true || Boolean(row.substitute);
  return row;
}

function draftExtras(raw: Json): ExtrasState {
  // Drafts from before the redesign called the tip "notes".
  const tip = str(raw.tip) || str(raw.notes);
  return {
    tip,
    showTip: raw.showTip === true || Boolean(tip),
    imageSrc: str(raw.imageSrc),
    imageCaption: str(raw.imageCaption),
  };
}

function draftStep(raw: Json): StepState {
  const fork = isObject(raw.fork) ? list(raw.fork.paths).slice(0, MAX_PATHS) : [];
  const step: StepState = {
    ...emptyStep(str(raw.text)),
    plain: raw.plain === true,
    substeps: texts(raw.substeps, MAX_SUBSTEPS),
    ...draftExtras(raw),
  };
  if (fork.length >= 2) {
    const active = isObject(raw.fork) && typeof raw.fork.active === 'number' ? raw.fork.active : 0;
    // Drafts from before paths had their own tip and photo kept the fork's on the step.
    const pathsHaveExtras = fork.some((p) => 'imageSrc' in p || 'tip' in p);
    step.fork = {
      active: chosenPath({ paths: fork }, active),
      paths: fork.map((p, i) => ({
        ...emptyPath(str(p.text), i > 0 && p.sameAsFirst === true),
        label: str(p.label),
        steps: texts(p.steps),
        ...(pathsHaveExtras ? draftExtras(p) : i === 0 ? extrasOf(step) : noExtras()),
      })),
    };
    Object.assign(step, noExtras());
  }
  return step;
}

/** A saved create-mode draft as a form, or null if it isn't one. Drafts are checked field by field. */
export function formFromDraft(raw: unknown): FormState | null {
  if (!isObject(raw)) return null;
  const form = emptyForm();
  form.title = str(raw.title);
  form.author = str(raw.author);
  // Drafts from before the author choice only have a typed name.
  form.authorMode =
    raw.authorMode === 'auto' || raw.authorMode === 'custom'
      ? raw.authorMode
      : form.author
        ? 'custom'
        : 'auto';
  form.category = isRecipeCategory(raw.category) ? raw.category : '';
  form.cardDescription = str(raw.cardDescription);
  form.yieldHeader = str(raw.yieldHeader);
  form.heroImage = recipePhoto({ heroImage: str(raw.heroImage) });
  form.tips = str(raw.tips);
  form.notes = str(raw.notes);
  form.times = timeTextsOf(raw.times);
  form.manualMinutes =
    typeof raw.manualMinutes === 'number' && raw.manualMinutes > 0 ? raw.manualMinutes : null;
  form.numberFrom = raw.numberFrom === 0 ? 0 : 1;
  form.sourceUrl = webAddress(str(raw.sourceUrl));

  const rows = list(raw.ingredientRows).map(draftRow);
  if (rows.length > 0) form.ingredientRows = rows;

  const sections = list(raw.sections)
    .map((s) => ({
      id: newId('sec'),
      title: str(s.title),
      restart: s.restart === true,
      steps: list(s.steps).map(draftStep),
    }))
    .filter((s) => s.steps.length > 0);
  // Drafts from before sections kept one list of steps.
  const steps = list(raw.steps).map(draftStep);
  if (sections.length > 0) form.sections = sections;
  else if (steps.length > 0) {
    form.sections = [{ id: newId('sec'), title: '', restart: false, steps }];
  }
  return form;
}

// --- To a recipe ----------------------------------------------------------------------------

const rowText = (row: IngredientRowState): RowText => ({
  name: row.name.trim(),
  amount: row.amount.trim(),
  note: row.showNote ? row.note.trim() : '',
  substitute: row.showSubstitute ? row.substitute.trim() : '',
  substituteAmount: row.showSubstitute ? row.substituteAmount.trim() : '',
});

const sameText = (a: RowText, b: RowText) =>
  a.name === b.name &&
  a.amount === b.amount &&
  a.note === b.note &&
  a.substitute === b.substitute &&
  a.substituteAmount === b.substituteAmount;

/**
 * An ingredient given an amount but no name ("200 g" of what?). An older recipe's row is left as
 * it was saved until it's changed.
 */
export function missingName(row: IngredientRowState): boolean {
  if (row.heading) return false;
  const shown = rowText(row);
  if (shown.name || !shown.amount) return false;
  return !(row.source && sameText(shown, row.source.shown));
}

/** The row as stored, or null when it's empty. */
export function rowToIngredient(row: IngredientRowState): Ingredient | null {
  const shown = rowText(row);
  if (row.heading || (!shown.name && !shown.amount)) return null;
  if (row.source && sameText(shown, row.source.shown)) {
    // Its heading is set from the rows above it (rowsToIngredients).
    const { section: _section, ...ingredient } = row.source.ingredient;
    return ingredient;
  }
  const ingredient: Ingredient = {
    text:
      shown.name && shown.amount ? `${shown.name} - ${shown.amount}` : shown.name || shown.amount,
    name: shown.name,
    note: shown.note,
  };
  if (shown.substitute) {
    ingredient.substitute = shown.substitute;
    if (shown.substituteAmount) ingredient.substituteAmount = shown.substituteAmount;
  }
  return ingredient;
}

/**
 * The ingredients as stored: empty rows dropped, and each heading kept as the `section` of the
 * ingredient under it. A heading with no ingredient under it is dropped.
 */
export function rowsToIngredients(rows: IngredientRowState[]): Ingredient[] {
  const ingredients: Ingredient[] = [];
  let heading = '';
  for (const row of rows) {
    if (row.heading) {
      heading = row.name.trim();
      continue;
    }
    const ingredient = rowToIngredient(row);
    if (!ingredient) continue;
    ingredients.push(heading ? { ...ingredient, section: heading } : ingredient);
    heading = '';
  }
  return ingredients;
}

/** A tip and photo as stored: `hasImage` always, the rest only when there's something in it. */
function storedExtras(extras: ExtrasState) {
  return {
    notes: (extras.showTip && extras.tip.trim()) || undefined,
    hasImage: Boolean(extras.imageSrc),
    imageSrc: extras.imageSrc || undefined,
    imageCaption: extras.imageCaption.trim() || undefined,
  };
}

/** The step as stored (its number comes later), or null when there's nothing in it. */
function stateToStep(state: StepState): Step | null {
  if (state.fork) {
    const paths = state.fork.paths
      .map((p, i) => ({
        label: p.label.trim(),
        text: p.text.trim(),
        sameAsFirst: i > 0 && p.sameAsFirst,
        steps: p.steps.map((s) => s.text.trim()).filter(Boolean),
        extras: storedExtras(p),
      }))
      .filter(
        (p, i) =>
          i === 0 ||
          p.label ||
          p.text ||
          p.extras.imageSrc ||
          (!p.sameAsFirst && p.steps.length > 0),
      );
    if (!paths.some((p) => p.text)) return null;
    // The first path's tip and photo are the step's own.
    const first = paths[0];
    if (paths.length < 2) {
      return { num: 0, text: first.text, ...first.extras };
    }
    return {
      num: 0,
      text: first.text,
      ...first.extras,
      fork: {
        paths: paths.map(({ label, text, sameAsFirst, steps, extras }, i) => {
          const path: ForkPath = { label, text };
          if (sameAsFirst) path.sameAsFirst = true;
          else if (steps.length > 0) path.steps = steps;
          if (i > 0) {
            if (extras.notes) path.notes = extras.notes;
            if (extras.imageSrc) {
              path.hasImage = true;
              path.imageSrc = extras.imageSrc;
              if (extras.imageCaption) path.imageCaption = extras.imageCaption;
            }
          }
          return path;
        }),
      },
    };
  }

  const text = state.text.trim();
  if (!text) return null;
  const substeps = state.plain ? [] : state.substeps.map((s) => s.text.trim()).filter(Boolean);
  return {
    num: 0,
    text,
    ...storedExtras(state),
    plain: state.plain || undefined,
    substeps: substeps.length > 0 ? substeps.slice(0, MAX_SUBSTEPS) : undefined,
  };
}

/** The method as stored: sections flattened into steps, empty ones dropped, numbers filled in. */
export function methodToSteps(sections: SectionState[], numberFrom: number): Step[] {
  const kept = sections
    .map((section) => ({
      title: section.title.trim(),
      restart: section.restart,
      steps: section.steps.map(stateToStep).filter((s): s is Step => s !== null),
    }))
    .filter((section) => section.steps.length > 0);

  const steps: Step[] = [];
  kept.forEach((section, s) => {
    section.steps.forEach((step, k) => {
      if (k === 0 && (s > 0 || section.title)) step.section = section.title;
      if (k === 0 && s > 0 && section.restart) step.restart = true;
      steps.push(step);
    });
  });
  // The numbers older app versions show, and the start that keeps a count from 0.
  const numbers = numberSteps(steps, numberFrom);
  steps.forEach((step, i) => {
    step.num = numbers[i] ?? 0;
  });
  return steps;
}

/** The recipe's content from the form, besides who wrote it. */
export function formToRecipe(form: FormState) {
  const times = timesFromText(form.times);
  return {
    name: form.title.trim(),
    category: form.category,
    heroImage: form.heroImage,
    yieldHeader: form.yieldHeader.trim(),
    cardDescription: form.cardDescription.trim() || undefined,
    ingredients: rowsToIngredients(form.ingredientRows),
    tips: form.tips.trim() || undefined,
    notes: form.notes.trim() || undefined,
    steps: methodToSteps(form.sections, form.numberFrom),
    times,
    // A typed time replaces an older recipe's single total.
    manualMinutes: times ? undefined : (form.manualMinutes ?? undefined),
    sourceUrl: form.sourceUrl || undefined,
    // Now steps in the method, so the old blocks go.
    laminationDirective: undefined,
    bakingOptions: undefined,
  };
}

/**
 * The form's readable text and the method's shape, for telling a real text edit apart from a
 * change to photos, author, category or time alone.
 */
export function formText(form: FormState): string {
  const recipe = formToRecipe(form);
  return JSON.stringify([
    recipe.name,
    recipe.cardDescription ?? '',
    recipe.yieldHeader,
    recipe.tips ?? '',
    recipe.notes ?? '',
    TIME_KINDS.map((kind) => form.times[kind].trim()),
    form.ingredientRows
      .map((row) => (row.heading ? { heading: row.name.trim() } : rowText(row)))
      .filter((r) => ('heading' in r ? r.heading : r.name || r.amount)),
    recipe.steps.map(({ hasImage: _h, imageSrc: _s, num: _n, fork, ...text }) => ({
      ...text,
      fork: fork?.paths.map(({ hasImage: _ph, imageSrc: _ps, ...path }) => path),
    })),
  ]);
}

const written = (text: string) => text.trim() !== '';
const hasExtras = (e: ExtrasState) => (e.showTip && written(e.tip)) || Boolean(e.imageSrc);

/** Whether a new recipe's form has anything worth keeping as a draft: any field at all. */
export function hasContent(form: FormState): boolean {
  return Boolean(
    [form.title, form.cardDescription, form.yieldHeader, form.tips, form.notes].some(written) ||
    TIME_KINDS.some((kind) => written(form.times[kind])) ||
    (form.authorMode === 'custom' && written(form.author)) ||
    form.heroImage ||
    form.manualMinutes !== null ||
    form.ingredientRows.some(
      (r) =>
        written(r.name) ||
        written(r.amount) ||
        (r.showNote && written(r.note)) ||
        (r.showSubstitute && written(r.substitute)),
    ) ||
    form.sections.some(
      (s) =>
        written(s.title) ||
        s.steps.some(
          (st) =>
            written(st.text) ||
            st.fork ||
            st.substeps.some((sub) => written(sub.text)) ||
            hasExtras(st),
        ),
    ),
  );
}

// --- Edits to the method ----------------------------------------------------------------------

/** Where a step is: its section and position there. */
function locate(sections: SectionState[], stepId: string) {
  for (let s = 0; s < sections.length; s++) {
    const k = sections[s].steps.findIndex((st) => st.id === stepId);
    if (k !== -1) return { s, k };
  }
  return null;
}

export function updateStep(
  sections: SectionState[],
  stepId: string,
  change: (step: StepState) => StepState,
): SectionState[] {
  return sections.map((section) =>
    section.steps.some((st) => st.id === stepId)
      ? { ...section, steps: section.steps.map((st) => (st.id === stepId ? change(st) : st)) }
      : section,
  );
}

/**
 * Moves a step up or down. Past the top or bottom of its section it crosses into the next one.
 * Returns the sections unchanged when it can't go further.
 */
export function moveStep(sections: SectionState[], stepId: string, dir: -1 | 1): SectionState[] {
  const at = locate(sections, stepId);
  if (!at) return sections;
  const target = at.k + dir;
  const inSection = target >= 0 && target < sections[at.s].steps.length;
  const neighbour = at.s + dir;
  if (!inSection && (neighbour < 0 || neighbour >= sections.length)) return sections;

  const next = sections.map((section) => ({ ...section, steps: [...section.steps] }));
  const [step] = next[at.s].steps.splice(at.k, 1);
  if (inSection) next[at.s].steps.splice(target, 0, step);
  else if (dir === -1) next[neighbour].steps.push(step);
  else next[neighbour].steps.unshift(step);
  return next;
}

/** Removes a step. `undo` puts it back where it was, into whatever the sections are by then. */
export function removeStep(sections: SectionState[], stepId: string) {
  const at = locate(sections, stepId);
  if (!at) return { sections, undo: (current: SectionState[]) => current };
  const step = sections[at.s].steps[at.k];
  const sectionId = sections[at.s].id;
  const next = sections.map((section, s) =>
    s === at.s ? { ...section, steps: section.steps.filter((st) => st.id !== stepId) } : section,
  );
  const undo = (current: SectionState[]) => {
    const home = current.find((section) => section.id === sectionId) ?? current[0];
    if (!home) return [{ ...emptySection(), steps: [step] }];
    return current.map((section) =>
      section === home
        ? {
            ...section,
            steps: [...section.steps.slice(0, at.k), step, ...section.steps.slice(at.k)],
          }
        : section,
    );
  };
  return { sections: next, undo };
}

/** Removes a section and its steps; `undo` puts it back. The first section always stays. */
export function removeSection(sections: SectionState[], sectionId: string) {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index <= 0) return { sections, undo: (current: SectionState[]) => current };
  const section = sections[index];
  return {
    sections: sections.filter((s) => s.id !== sectionId),
    undo: (current: SectionState[]) => [
      ...current.slice(0, index),
      section,
      ...current.slice(index),
    ],
  };
}

/**
 * Splits a step into two paths (its text, tip and photo go to the first), or joins a fork back
 * into one step, which keeps the open path's.
 */
export function toggleFork(step: StepState): StepState {
  if (step.fork) {
    const open = step.fork.paths[step.fork.active] ?? step.fork.paths[0];
    return { ...step, text: open.text, ...extrasOf(open), fork: null };
  }
  return {
    ...step,
    plain: false,
    substeps: [],
    ...noExtras(),
    fork: {
      active: 0,
      paths: [{ ...emptyPath(step.text), ...extrasOf(step) }, emptyPath('', true)],
    },
  };
}

export function addPath(step: StepState): StepState {
  if (!step.fork || step.fork.paths.length >= MAX_PATHS) return step;
  const paths = [...step.fork.paths, emptyPath('', true)];
  return { ...step, fork: { paths, active: paths.length - 1 } };
}

export function removePath(step: StepState, index: number): StepState {
  if (!step.fork || index <= 0) return step;
  const paths = step.fork.paths.filter((_, i) => i !== index);
  if (paths.length < 2) return toggleFork({ ...step, fork: { paths, active: 0 } });
  return { ...step, fork: { paths, active: Math.min(step.fork.active, paths.length - 1) } };
}

export function updatePath(
  step: StepState,
  index: number,
  change: (path: PathState) => PathState,
): StepState {
  if (!step.fork) return step;
  return {
    ...step,
    fork: {
      ...step.fork,
      paths: step.fork.paths.map((path, i) => (i === index ? change(path) : path)),
    },
  };
}

/**
 * The number shown on each step, by id: null for unnumbered text. A fork's own steps are
 * listed under `${forkId}:${pathIndex}`, numbered for each path; the steps after a fork follow
 * the path open in the editor.
 */
export function editorNumbers(sections: SectionState[], numberFrom: number) {
  const steps = sections.flatMap((section, s) =>
    section.steps.map((step, k) =>
      k === 0 && s > 0 && section.restart ? { ...step, restart: true } : step,
    ),
  );
  const choices: Record<number, number> = {};
  steps.forEach((step, i) => {
    if (step.fork) choices[i] = step.fork.active;
  });
  const numbers = numberSteps(steps, numberFrom, choices);
  const byId = new Map<string, number | null>();
  steps.forEach((step, i) => {
    byId.set(step.id, numbers[i]);
    step.fork?.paths.forEach((_path, p) => {
      byId.set(`${step.id}:${p}`, (numbers[i] ?? 0) + 1);
    });
  });
  return byId;
}

// --- Pasting ----------------------------------------------------------------------------------

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

// A list marker at the start of a line, tick boxes from recipe sites included.
const BULLET = /^[-•*·–—▢☐□✓]\s+/;
// A line that only names what follows: "For the sauce:".
const HEADING = /^(?!\d)([^:]{1,60}):$/;

const UNITS =
  'cups?|tsp|teaspoons?|tbsp|tablespoons?|g|grams?|ml|kg|l|lit(?:er|re)s?|oz|ounces?|lbs?|pounds?|' +
  'cloves?|slices?|pinch(?:es)?|handfuls?|cans?|sticks?|bunch(?:es)?|sprigs?|packages?|' +
  'szklank[aiy]?|łyżeczk[aiy]|łyżeczek|łyż(?:ka|ki|ek)|sztuk[aiy]?|szt\\.?|dag|kostk[aiy]|' +
  'opakowani[ae]|szczypt[ay]?|ząbk(?:i|ów)|ząbek|puszk[aiy]|pęcz(?:ek|ki|ków)|garś(?:ć|ci)|' +
  'litr(?:y|ów|a)?|dozen';
// A number ("300", "1 1/2", "2-3", "½") with its unit, if it has one.
const QUANTITY = String.raw`(?:\d|[¼-¾⅐-⅞])[\d\s/.,¼-¾⅐-⅞–-]*(?:\s*(?:${UNITS})(?![\p{L}\d]))?`;
// "300 g flour", "1 1/2 cups milk", "1/2 to 2/3 cup water", "1 cup plus 2 tbsp sugar": the
// amount (one quantity, or several joined by "to", "and", "plus"), then the name.
const LEADING_AMOUNT = new RegExp(
  String.raw`^(${QUANTITY}(?:\s*(?:to|and|plus|or|do|i|lub)\s+${QUANTITY})*)\s+(.+)$`,
  'iu',
);

// Tidies what taking brackets out of a name leaves behind: "milk , whole" and a trailing comma.
const tidyName = (name: string) =>
  name
    .replace(/\s+([,;])/g, '$1')
    .replace(/[,;]\s*$/, '')
    .trim();

/**
 * Where the text's outermost brackets open and close ("(a (b) c)" is one pair), or null when
 * its brackets don't pair up, in which case nothing about them is assumed.
 */
function bracketPairs(text: string): { start: number; end: number }[] | null {
  const pairs: { start: number; end: number }[] = [];
  const closers: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(' || char === '[') {
      if (closers.length === 0) start = i;
      closers.push(char === '(' ? ')' : ']');
    } else if (char === ')' || char === ']') {
      if (closers.pop() !== char) return null;
      if (closers.length === 0) pairs.push({ start, end: i + 1 });
    }
  }
  return closers.length === 0 ? pairs : null;
}

/** A note without the brackets some sites double up ("((optional))") or a comma left in front. */
function unwrapped(note: string): string {
  const text = note.trim().replace(/^[,;]\s*/, '');
  const pairs = bracketPairs(text);
  return pairs?.length === 1 && pairs[0].start === 0 && pairs[0].end === text.length
    ? unwrapped(text.slice(1, -1))
    : text;
}

/** The text with what's in brackets blanked out, so a ":" or " - " inside them isn't a divider. */
function outsideBrackets(text: string): string {
  let bare = text;
  for (const { start, end } of bracketPairs(text) ?? []) {
    bare = bare.slice(0, start) + ' '.repeat(end - start) + bare.slice(end);
  }
  return bare;
}

/**
 * One ingredient row from a line. A line that starts with a quantity is "300 g flour": the
 * amount, then the name. Otherwise "Flour - 300 g" or "Flour: 300 g" is the name, then the
 * amount (`strict`, for lines a website wrote rather than the cook: only when what follows
 * starts with a quantity, since sites use dashes and colons for anything). What's in brackets
 * after the name becomes the row's note ("Flour (sifted)"); brackets straight after the amount
 * stay with it ("1 can (400 g)"). Nothing is dropped or reworded.
 */
export function ingredientFromLine(line: string, strict = false): IngredientRowState {
  const clean = line.trim().replace(BULLET, '');
  const bare = outsideBrackets(clean);
  const row = emptyRow();
  const leading = clean.match(LEADING_AMOUNT);
  const dash = bare.indexOf(' - ');
  const colon = bare.indexOf(':');
  const divider = dash > 0 ? { at: dash, length: 3 } : colon > 0 ? { at: colon, length: 1 } : null;
  const after = divider ? clean.slice(divider.at + divider.length).trim() : '';
  if (leading) {
    row.amount = leading[1].trim();
    row.name = leading[2].trim();
    // "1 can (400 g) tomatoes": the size belongs to the amount.
    const size = bracketPairs(row.name)?.[0];
    if (size?.start === 0 && row.name.slice(size.end).trim()) {
      row.amount = `${row.amount} ${row.name.slice(0, size.end)}`;
      row.name = row.name.slice(size.end).trim();
    }
  } else if (divider && after && (!strict || /^(?:\d|[¼-¾⅐-⅞])/.test(after))) {
    row.name = clean.slice(0, divider.at).trim();
    row.amount = after;
  } else {
    row.name = clean;
  }

  const pairs = bracketPairs(row.name) ?? [];
  let name = row.name;
  for (const { start, end } of [...pairs].reverse()) name = name.slice(0, start) + name.slice(end);
  name = tidyName(name.replace(/\s{2,}/g, ' '));
  // A name that is all brackets stays as written.
  if (name && pairs.length > 0) {
    row.note = pairs
      .map(({ start, end }) => unwrapped(row.name.slice(start + 1, end - 1)))
      .filter(Boolean)
      .join(', ');
    row.name = name;
    row.showNote = Boolean(row.note);
  }
  return row;
}

/**
 * Ingredient rows from pasted lines (see ingredientFromLine). A line that only names a part of
 * the list ("For the sauce:") becomes a heading.
 */
export function pastedIngredients(text: string): IngredientRowState[] {
  return lines(text).map((line) => {
    const heading = line.replace(BULLET, '').match(HEADING);
    return heading ? headingRow(heading[1].trim()) : ingredientFromLine(line);
  });
}

interface LineMark {
  /** "part" is a lettered part of a numbered step: "1a)". */
  kind: 'number' | 'part' | 'letter' | 'bullet' | 'none';
  text: string;
}

/** What a method line starts with, and its text without it. */
function markOf(line: string): LineMark {
  const part = line.match(/^\d{1,2}[a-z]\s*[.)]\s*(?=\S)/i);
  if (part) return { kind: 'part', text: line.slice(part[0].length) };
  const number =
    line.match(/^(?:step|krok)\s*\d{1,2}\s*[:.)–-]?\s*/i) ??
    // "1. Mix", "2) Knead", "3.Bake", but not "1.5 cups".
    line.match(/^\d{1,2}\s*[.):]\s+/) ??
    line.match(/^\d{1,2}[.)](?=[^\d\s])/);
  if (number) return { kind: 'number', text: line.slice(number[0].length) };
  const letter = line.match(/^[a-z]\s*[.)]\s+/i);
  if (letter) return { kind: 'letter', text: line.slice(letter[0].length) };
  const bullet = line.match(BULLET);
  if (bullet) return { kind: 'bullet', text: line.slice(bullet[0].length) };
  return { kind: 'none', text: line };
}

/**
 * One step from text known to be a single step (a recipe site marks its steps itself): its
 * number is dropped, lettered or bulleted lines under it become substeps, and other lines are
 * the rest of its text. Null when there's nothing in it.
 */
export function stepFromText(text: string): StepState | null {
  const [first, ...rest] = lines(text);
  if (!first) return null;
  const head = markOf(first);
  const step = emptyStep(head.kind === 'number' || head.kind === 'bullet' ? head.text : first);
  for (const line of rest) {
    const mark = markOf(line);
    const last = step.substeps.at(-1);
    if (mark.kind !== 'none' && step.substeps.length < MAX_SUBSTEPS) {
      step.substeps.push(textItem(mark.text));
    } else if (last) last.text = `${last.text} ${line}`;
    else step.text = `${step.text} ${line}`;
  }
  return step.text.trim() ? step : null;
}

/** A pasted run of steps, under its heading (empty for none). */
export interface PastedSection {
  title: string;
  steps: StepState[];
}

/**
 * The method from pasted text. It reads how the text is laid out: numbered steps ("1.", "2)",
 * "Step 3:"), lettered parts under them ("a)", "1a.") as substeps, dashes and bullets (steps on
 * their own, substeps under a numbered step), a line that only names what follows ("For the
 * icing:") as a section heading, and a line with no marker as the rest of the step above it.
 * Text with no markers at all is one step per line. The words stay as written.
 */
export function pastedMethod(text: string): PastedSection[] {
  const marked = lines(text).map(markOf);
  const kinds = new Set(marked.map((m) => m.kind));
  const numbered = kinds.has('number') || kinds.has('part');
  // One marked line among plain ones is a stray dash or number, not a layout.
  const structured = marked.filter((m) => m.kind !== 'none').length >= 2;

  const sections: PastedSection[] = [{ title: '', steps: [] }];
  const steps = () => sections.at(-1)!.steps;
  // The step that lines are being added to, and whether a numbered line began it.
  const at: { open: StepState | null; byNumber: boolean } = { open: null, byNumber: false };
  const start = (stepText: string, byNumber = false) => {
    at.open = emptyStep(stepText);
    at.byNumber = byNumber;
    steps().push(at.open);
  };
  const addPart = (partText: string) => {
    if (at.open && at.open.substeps.length < MAX_SUBSTEPS) {
      at.open.substeps.push(textItem(partText));
    } else start(partText);
  };

  for (const mark of marked) {
    if (!structured) {
      start(mark.text);
      continue;
    }
    // In a numbered list only numbers start steps; otherwise the bullets do, or the letters.
    const startsStep =
      mark.kind === 'number' ||
      (!numbered && (mark.kind === 'bullet' || (mark.kind === 'letter' && !kinds.has('bullet'))));
    if (startsStep) {
      start(mark.text, mark.kind === 'number');
    } else if (mark.kind === 'part') {
      // "1a" under a "1." line is its substep; with no such line, each part is a step.
      if (at.byNumber) addPart(mark.text);
      else start(mark.text);
    } else if (mark.kind === 'letter' || mark.kind === 'bullet') {
      addPart(mark.text);
    } else if (HEADING.test(mark.text) || (mark.text.length <= 60 && ALTERNATIVE.test(mark.text))) {
      const title = mark.text.replace(/:$/, '').trim();
      if (steps().length === 0) sections.at(-1)!.title = title;
      else sections.push({ title, steps: [] });
      at.open = null;
      at.byNumber = false;
    } else if (at.open) {
      // A wrapped line: the rest of the step (or substep) above it.
      const last = at.open.substeps.at(-1);
      if (last) last.text = `${last.text} ${mark.text}`;
      else at.open.text = `${at.open.text} ${mark.text}`;
    } else {
      // Words before the first step: unnumbered text.
      steps().push({ ...emptyStep(mark.text), plain: true });
    }
  }
  return foldForks(sections.filter((section) => section.steps.length > 0));
}

// "Option 1: Oven", "Wariant B", "Method 2 - Air fryer": one of several ways to do the same thing.
const ALTERNATIVE =
  /^(?:option|opcja|wariant|method|metoda|sposób|version|wersja)\s*(\d|[a-c])\s*(?:[:.)–-]\s*(.*))?$/i;
const MAX_LABEL = 24;

/**
 * Sections headed as alternatives of each other ("Option 1", "Option 2") become one step with
 * a path for each, which is how the recipe page offers a choice. Only a run of two or three,
 * counted from 1 (or A), of plain steps: anything else stays as the sections it was.
 */
export function foldForks(sections: PastedSection[]): PastedSection[] {
  const result: PastedSection[] = [];
  for (let i = 0; i < sections.length; i++) {
    const run: { label: string; steps: StepState[] }[] = [];
    while (i + run.length < sections.length) {
      const section = sections[i + run.length];
      const match = section.title.match(ALTERNATIVE);
      const expected = [String(run.length + 1), 'abc'[run.length]];
      if (!match || !expected.includes(match[1].toLowerCase())) break;
      if (section.steps.length === 0) break;
      if (section.steps.some((s) => s.plain || s.fork || s.substeps.length > 0)) break;
      const name = (match[2] ?? '').trim();
      const counted = section.title.slice(0, section.title.length - (match[2] ?? '').length);
      run.push({
        label: name && name.length <= MAX_LABEL ? name : counted.replace(/[\s:.)–-]+$/, '') || name,
        steps: section.steps,
      });
    }
    if (run.length < 2 || run.length > MAX_PATHS) {
      result.push(sections[i]);
      continue;
    }
    const first = run[0].steps[0];
    const fork: ForkState = {
      active: 0,
      paths: run.map(({ label, steps }) => ({
        ...emptyPath(steps[0].text),
        label,
        steps: steps.slice(1).map((s) => textItem(s.text)),
      })),
    };
    const forked = { ...emptyStep(first.text), fork };
    // The choice joins the steps above it, in their section.
    const above = result.at(-1);
    if (above) above.steps.push(forked);
    else result.push({ title: '', steps: [forked] });
    i += run.length - 1;
  }
  return result;
}

/** How many steps a pasted method has, its paths' own steps not counted. */
export const pastedStepCount = (pasted: PastedSection[]) =>
  pasted.reduce((n, section) => n + section.steps.length, 0);

/**
 * The method with pasted sections added after it: steps with no heading carry on the last
 * section, each heading starts a section, and a section with nothing written yet is filled.
 */
export function addPastedMethod(sections: SectionState[], pasted: PastedSection[]): SectionState[] {
  const next = sections.length > 0 ? [...sections] : [emptySection()];
  for (const section of pasted) {
    const last = next[next.length - 1];
    const blank = last.steps.every((s) => !s.text.trim() && !s.fork);
    if (blank && (!last.title.trim() || !section.title)) {
      next[next.length - 1] = { ...last, title: section.title || last.title, steps: section.steps };
    } else if (!section.title) {
      next[next.length - 1] = { ...last, steps: [...last.steps, ...section.steps] };
    } else {
      next.push({ ...emptySection(section.title), steps: section.steps });
    }
  }
  return next;
}
